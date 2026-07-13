import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { FileEntity, FileStatus } from '../../entities/file.entity';
import { SessionService } from '../session/session.service';
import { StorageService } from '../storage/storage.service';
import { DownloadFileStore } from './download-file-store.service';

@Injectable()
export class DownloadFileAccessService {
  constructor(
    private readonly config: AppConfigService,
    private readonly fileStore: DownloadFileStore,
    private readonly sessionService: SessionService,
    private readonly storageService: StorageService,
  ) {}

  async getFileStatus(fileId: string, sessionId: string): Promise<FileEntity> {
    const file = await this.fileStore.findForSession(fileId, sessionId);
    if (!file) {
      throw new NotFoundException('File not found');
    }

    return file;
  }

  async getDownloadUrl(fileId: string, sessionId: string): Promise<string> {
    const file = await this.fileStore.findForSession(fileId, sessionId);
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
      await this.fileStore.save(file);
    }

    await this.sessionService.incrementSessionDownloads(sessionId);
    return this.storageService.getSignedDownloadUrl(file.key, file.contentType);
  }
}
