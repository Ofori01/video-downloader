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
  ): Promise<{
    fileId: string;
    jobId: string;
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

    const metadata = (await this.ytDlpService.getMetadata(
      url,
    )) as YtDlpMetadata;
    const estimatedSize = this.estimateSize(metadata);

    if (estimatedSize <= 0) {
      throw new BadRequestException(
        'Unable to estimate file size for this source',
      );
    }

    if (estimatedSize > this.config.maxFileBytes) {
      throw new BadRequestException('Requested file exceeds max file size');
    }

    const [sessionBytes, storageUsed] = await Promise.all([
      this.sessionService.getSessionBytes(sessionId),
      this.redisService.getNumber(STORAGE_USED_KEY),
    ]);

    if (sessionBytes + estimatedSize > this.config.sessionMaxBytes) {
      throw new ForbiddenException('Session storage quota exceeded');
    }

    if (storageUsed + estimatedSize > this.config.maxStorageBytes) {
      throw new ServiceUnavailableException('System storage limit reached');
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
      });

      const saved = await this.fileRepository.save(file);
      const jobId = await this.queueProducer.enqueueDownloadJob({
        fileId: saved.id,
        url,
        sessionId,
        reservedBytes: estimatedSize,
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
      file.expiresAt = new Date(
        now.getTime() + this.config.fileTtlSeconds * 1000,
      );
      await this.fileRepository.save(file);
    }

    await this.sessionService.incrementSessionDownloads(sessionId);
    return this.storageService.getSignedDownloadUrl(file.key);
  }

  async markReady(fileId: string, key: string, size: number): Promise<void> {
    await this.fileRepository.update(fileId, {
      key,
      size: String(size),
      status: FileStatus.READY,
      errorReason: null,
    });
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

  private estimateSize(metadata: YtDlpMetadata): number {
    const raw =
      metadata?.filesize ??
      metadata?.filesize_approx ??
      metadata?.requested_downloads?.[0]?.filesize ??
      metadata?.requested_downloads?.[0]?.filesize_approx;

    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
