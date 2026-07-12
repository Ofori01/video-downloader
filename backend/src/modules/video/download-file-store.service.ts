import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { FileEntity, FileStatus } from '../../entities/file.entity';

export interface CreateDownloadFileInput {
  url: string;
  sessionId: string;
  estimatedSize: number;
  profileId?: string;
}

@Injectable()
export class DownloadFileStore {
  constructor(
    @InjectRepository(FileEntity)
    private readonly fileRepository: Repository<FileEntity>,
  ) {}

  async createQueuedDownload(
    input: CreateDownloadFileInput,
  ): Promise<FileEntity> {
    const file = this.fileRepository.create({
      key: `pending/${randomUUID()}`,
      sourceUrl: input.url,
      size: String(input.estimatedSize),
      status: FileStatus.QUEUED,
      sessionId: input.sessionId,
      profileId: input.profileId ?? null,
    });

    return this.fileRepository.save(file);
  }

  async createProcessingDownload(
    input: CreateDownloadFileInput,
  ): Promise<FileEntity> {
    const file = this.fileRepository.create({
      key: `pending/${randomUUID()}`,
      sourceUrl: input.url,
      size: String(input.estimatedSize),
      status: FileStatus.PROCESSING,
      sessionId: input.sessionId,
      profileId: input.profileId ?? null,
    });

    return this.fileRepository.save(file);
  }

  async attachQueueJob(fileId: string, jobId: string): Promise<void> {
    await this.fileRepository.update(fileId, { queueJobId: jobId });
  }

  async findForSession(
    fileId: string,
    sessionId: string,
  ): Promise<FileEntity | null> {
    return this.fileRepository.findOneBy({ id: fileId, sessionId });
  }

  async save(file: FileEntity): Promise<FileEntity> {
    return this.fileRepository.save(file);
  }

  async markReady(
    fileId: string,
    key: string,
    size: number,
    expiresAt: Date,
  ): Promise<void> {
    await this.fileRepository.update(fileId, {
      key,
      size: String(size),
      status: FileStatus.READY,
      expiresAt,
      errorReason: null,
    });
  }

  async markFailed(fileId: string, reason: string): Promise<void> {
    await this.fileRepository.update(fileId, {
      status: FileStatus.FAILED,
      errorReason: reason,
    });
  }

  async findExpiredReadyFiles(now = new Date()): Promise<FileEntity[]> {
    return this.fileRepository
      .createQueryBuilder('file')
      .where('file.status = :status', { status: FileStatus.READY })
      .andWhere('file.expiresAt IS NOT NULL')
      .andWhere('file.expiresAt <= :now', { now })
      .getMany();
  }

  async markDeleted(fileId: string): Promise<void> {
    await this.fileRepository.update(fileId, {
      status: FileStatus.DELETED,
    });
  }

  async getActiveSessionBytes(sessionId: string): Promise<number> {
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

  async getActiveStorageBytes(): Promise<number> {
    const raw = await this.fileRepository
      .createQueryBuilder('file')
      .select('COALESCE(SUM(CAST(file.size AS bigint)), 0)', 'total')
      .where('file.status IN (:...statuses)', {
        statuses: [FileStatus.PROCESSING, FileStatus.READY],
      })
      .andWhere('file.size IS NOT NULL')
      .getRawOne<{ total: string }>();

    return Number(raw?.total ?? 0);
  }

  async findQueuedDownloads(limit: number): Promise<FileEntity[]> {
    return this.fileRepository.find({
      where: { status: FileStatus.QUEUED },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  async claimQueuedDownload(fileId: string): Promise<boolean> {
    const result = await this.fileRepository.update(
      { id: fileId, status: FileStatus.QUEUED },
      {
        status: FileStatus.PROCESSING,
        queueJobId: null,
        errorReason: null,
      },
    );

    return (result.affected ?? 0) > 0;
  }
}
