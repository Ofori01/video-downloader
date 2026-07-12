import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppConfigService } from '../../config/app-config.service';
import { FileEntity, FileStatus } from '../../entities/file.entity';
import { STORAGE_USED_KEY } from '../queue/queue.constants';
import { QueueProducerService } from '../queue/queue.producer.service';
import { RedisService } from '../queue/redis.service';
import { SessionService } from '../session/session.service';
import { StorageService } from '../storage/storage.service';
import { YtDlpService } from './ytdlp.service';

interface YtDlpRequestedDownload {
  filesize?: number;
  filesize_approx?: number;
}

interface YtDlpMetadata {
  filesize?: number;
  filesize_approx?: number;
  requested_downloads?: YtDlpRequestedDownload[];
}

const QUEUED_STATUS = 'queued' as FileStatus;

@Injectable()
export class VideoService {
  constructor(
    @InjectRepository(FileEntity)
    private readonly fileRepository: Repository<FileEntity>,
    private readonly config: AppConfigService,
    private readonly queueProducer: QueueProducerService,
    private readonly redisService: RedisService,
    private readonly sessionService: SessionService,
    private readonly storageService: StorageService,
    private readonly ytDlpService: YtDlpService,
  ) {}

  async submitDownload(
    url: string,
    sessionId: string,
    profileId?: string,
  ): Promise<{
    fileId: string;
    jobId: string | null;
    estimatedSize: number;
    status: FileStatus;
  }> {
    if (!this.config.enableNewRequests) {
      throw new ServiceUnavailableException(
        'New requests are currently disabled',
      );
    }

    const sessionJobs =
      await this.sessionService.incrementSessionJobs(sessionId);
    if (sessionJobs > this.config.sessionMaxJobs) {
      throw new ForbiddenException('Session has exceeded job rate limit');
    }

    let estimatedSize: number;

    if (profileId) {
      // Use actual filesize from the selected format
      estimatedSize = await this.ytDlpService.getFormatSize(url, profileId);
      if (estimatedSize <= 0) {
        throw new BadRequestException(
          'Unable to determine file size for selected format',
        );
      }
    } else {
      // Fallback: use best format
      const metadata = (await this.ytDlpService.getMetadata(
        url,
      )) as YtDlpMetadata;
      estimatedSize = this.estimateSize(metadata);

      if (estimatedSize <= 0) {
        // More detailed error for debugging
        const hasFormats =
          metadata &&
          typeof metadata === 'object' &&
          Array.isArray((metadata as any).formats);
        throw new BadRequestException(
          hasFormats
            ? 'Unable to estimate file size - selected format has no size information'
            : 'Unable to estimate file size for this source. Try using the profile selection first.',
        );
      }
    }

    if (estimatedSize > this.config.maxFileBytes) {
      throw new BadRequestException('Requested file exceeds max file size');
    }

    if (estimatedSize > this.config.sessionMaxBytes) {
      throw new BadRequestException(
        'Requested file exceeds per-session storage quota',
      );
    }

    const [sessionBytes, storageUsed] = await Promise.all([
      this.sessionService.getSessionBytes(sessionId),
      this.redisService.getNumber(STORAGE_USED_KEY),
    ]);

    if (sessionBytes + estimatedSize > this.config.sessionMaxBytes) {
      const dbSessionBytes = await this.getSessionBytesFromDb(sessionId);

      if (dbSessionBytes !== sessionBytes) {
        await this.sessionService.setSessionBytes(sessionId, dbSessionBytes);
      }

      if (dbSessionBytes + estimatedSize > this.config.sessionMaxBytes) {
        throw new ForbiddenException('Session storage quota exceeded');
      }
    }

    if (storageUsed + estimatedSize > this.config.maxStorageBytes) {
      const queued = this.fileRepository.create({
        key: `pending/${randomUUID()}`,
        sourceUrl: url,
        size: String(estimatedSize),
        status: QUEUED_STATUS,
        sessionId,
        profileId: profileId ?? null,
      });

      const saved = await this.fileRepository.save(queued);
      return {
        fileId: saved.id,
        jobId: null,
        estimatedSize,
        status: QUEUED_STATUS,
      };
    }

    await Promise.all([
      this.sessionService.reserveSessionBytes(sessionId, estimatedSize),
      this.redisService.incrementBy(STORAGE_USED_KEY, estimatedSize),
    ]);

    try {
      const file = this.fileRepository.create({
        key: `pending/${randomUUID()}`,
        sourceUrl: url,
        size: String(estimatedSize),
        status: FileStatus.PROCESSING,
        sessionId,
        profileId: profileId ?? null,
      });

      const saved = await this.fileRepository.save(file);
      const jobId = await this.queueProducer.enqueueDownloadJob({
        fileId: saved.id,
        url,
        sessionId,
        reservedBytes: estimatedSize,
        profileId,
      });

      saved.queueJobId = jobId;
      await this.fileRepository.save(saved);

      return {
        fileId: saved.id,
        jobId,
        estimatedSize,
        status: FileStatus.PROCESSING,
      };
    } catch (error) {
      await Promise.all([
        this.sessionService.releaseSessionBytes(sessionId, estimatedSize),
        this.redisService.decrementBy(STORAGE_USED_KEY, estimatedSize),
      ]);
      throw error;
    }
  }

  async getFileStatus(fileId: string, sessionId: string): Promise<FileEntity> {
    const file = await this.fileRepository.findOneBy({ id: fileId, sessionId });
    if (!file) {
      throw new NotFoundException('File not found');
    }

    return file;
  }

  async getDownloadUrl(fileId: string, sessionId: string): Promise<string> {
    const file = await this.fileRepository.findOneBy({ id: fileId, sessionId });
    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (file.status !== FileStatus.READY) {
      throw new BadRequestException('File is not ready for download');
    }

    if (!file.downloadedAt) {
      const now = new Date();
      file.downloadedAt = now;
      if (!file.expiresAt) {
        file.expiresAt = new Date(
          now.getTime() + this.config.fileTtlSeconds * 1000,
        );
      }
      await this.fileRepository.save(file);
    }

    await this.sessionService.incrementSessionDownloads(sessionId);
    return this.storageService.getSignedDownloadUrl(file.key);
  }

  async markReady(fileId: string, key: string, size: number): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.config.fileTtlSeconds * 1000,
    );

    await this.fileRepository.update(fileId, {
      key,
      size: String(size),
      status: FileStatus.READY,
      expiresAt,
      errorReason: null,
    });
  }

  async reconcileReservationForCompletedFile(
    sessionId: string,
    reservedBytes: number,
    actualBytes: number,
  ): Promise<void> {
    const reserved = Number.isFinite(reservedBytes)
      ? Math.max(0, Math.trunc(reservedBytes))
      : 0;
    const actual = Number.isFinite(actualBytes)
      ? Math.max(0, Math.trunc(actualBytes))
      : 0;

    if (reserved === actual) {
      return;
    }

    if (reserved > actual) {
      const releaseBytes = reserved - actual;
      await Promise.all([
        this.sessionService.releaseSessionBytes(sessionId, releaseBytes),
        this.redisService.decrementBy(STORAGE_USED_KEY, releaseBytes),
      ]);
      return;
    }

    const additionalBytes = actual - reserved;
    await Promise.all([
      this.sessionService.reserveSessionBytes(sessionId, additionalBytes),
      this.redisService.incrementBy(STORAGE_USED_KEY, additionalBytes),
    ]);
  }

  async markFailed(fileId: string, reason: string): Promise<void> {
    await this.fileRepository.update(fileId, {
      status: FileStatus.FAILED,
      errorReason: reason,
    });
  }

  async releaseReservation(sessionId: string, bytes: number): Promise<void> {
    await Promise.all([
      this.sessionService.releaseSessionBytes(sessionId, bytes),
      this.redisService.decrementBy(STORAGE_USED_KEY, bytes),
    ]);
  }

  async findExpiredReadyFiles(): Promise<FileEntity[]> {
    return this.fileRepository
      .createQueryBuilder('file')
      .where('file.status = :status', { status: FileStatus.READY })
      .andWhere('file.expiresAt IS NOT NULL')
      .andWhere('file.expiresAt <= :now', { now: new Date().toISOString() })
      .getMany();
  }

  async markDeleted(fileId: string): Promise<void> {
    await this.fileRepository.update(fileId, {
      status: FileStatus.DELETED,
    });
  }

  async reconcileStorageUsageFromDb(): Promise<number> {
    const raw = await this.fileRepository
      .createQueryBuilder('file')
      .select('COALESCE(SUM(CAST(file.size AS bigint)), 0)', 'total')
      .where('file.status IN (:...statuses)', {
        statuses: [FileStatus.PROCESSING, FileStatus.READY],
      })
      .andWhere('file.size IS NOT NULL')
      .getRawOne<{ total: string }>();

    const total = Number(raw?.total ?? 0);
    await this.redisService.raw.set(STORAGE_USED_KEY, String(total));
    return total;
  }

  async promoteQueuedFiles(limit = 25): Promise<number> {
    const queuedFiles = await this.fileRepository.find({
      where: { status: QUEUED_STATUS },
      order: { createdAt: 'ASC' },
      take: limit,
    });

    let promoted = 0;

    for (const file of queuedFiles) {
      const estimatedSize = Number(file.size ?? 0);
      if (!Number.isFinite(estimatedSize) || estimatedSize <= 0) {
        await this.markFailed(file.id, 'Invalid queued file size');
        continue;
      }

      const [sessionBytes, storageUsed] = await Promise.all([
        this.sessionService.getSessionBytes(file.sessionId),
        this.redisService.getNumber(STORAGE_USED_KEY),
      ]);

      if (sessionBytes + estimatedSize > this.config.sessionMaxBytes) {
        await this.markFailed(file.id, 'Session storage quota exceeded');
        continue;
      }

      if (storageUsed + estimatedSize > this.config.maxStorageBytes) {
        break;
      }

      await Promise.all([
        this.sessionService.reserveSessionBytes(file.sessionId, estimatedSize),
        this.redisService.incrementBy(STORAGE_USED_KEY, estimatedSize),
      ]);

      try {
        const jobId = await this.queueProducer.enqueueDownloadJob({
          fileId: file.id,
          url: file.sourceUrl,
          sessionId: file.sessionId,
          reservedBytes: estimatedSize,
          profileId: file.profileId ?? undefined,
        });

        const result = await this.fileRepository.update(
          { id: file.id, status: QUEUED_STATUS },
          {
            status: FileStatus.PROCESSING,
            queueJobId: jobId,
            errorReason: null,
          },
        );

        if ((result.affected ?? 0) === 0) {
          await this.releaseReservation(file.sessionId, estimatedSize);
          continue;
        }

        promoted += 1;
      } catch (error) {
        await this.releaseReservation(file.sessionId, estimatedSize);
        await this.markFailed(file.id, String(error));
      }
    }

    return promoted;
  }

  private estimateSize(metadata: YtDlpMetadata): number {
    // Try root level locations first
    const raw =
      metadata?.filesize ??
      metadata?.filesize_approx ??
      metadata?.requested_downloads?.[0]?.filesize ??
      metadata?.requested_downloads?.[0]?.filesize_approx;

    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }

    // Fallback: try to estimate from best format if available
    // This handles cases like X.com where root-level filesize might not exist
    if (metadata && typeof metadata === 'object') {
      const metaObj = metadata as any;
      const formats = Array.isArray(metaObj.formats) ? metaObj.formats : [];

      if (formats.length > 0) {
        // Try to find best format and estimate from it
        const best =
          formats.find((f: any) => f.format_id === metaObj.format_id) ||
          formats[0];

        if (best) {
          // Use same logic as getActualFormatSize but inline to avoid dependency
          if (best.filesize > 0) return best.filesize;
          if (best.filesize_approx > 0) return best.filesize_approx;

          // Estimate from bitrate if available
          const bitrate = best.tbr || best.abr || best.vbr || 0;
          const duration = best.duration || metaObj.duration || 0;
          if (bitrate > 0 && duration > 0) {
            return Math.round((bitrate * 1000 * duration) / 8);
          }
        }
      }
    }

    return 0;
  }

  private async getSessionBytesFromDb(sessionId: string): Promise<number> {
    const raw = await this.fileRepository
      .createQueryBuilder('file')
      .select('COALESCE(SUM(CAST(file.size AS bigint)), 0)', 'total')
      .where('file.sessionId = :sessionId', { sessionId })
      .andWhere('file.status IN (:...statuses)', {
        statuses: [FileStatus.PROCESSING, FileStatus.READY],
      })
      .andWhere('file.size IS NOT NULL')
      .getRawOne<{ total: string }>();

    return Number(raw?.total ?? 0);
  }
}
