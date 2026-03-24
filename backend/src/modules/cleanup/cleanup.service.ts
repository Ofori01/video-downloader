import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { VideoService } from '../video/video.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    private readonly videoService: VideoService,
    private readonly storageService: StorageService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async cleanupExpiredFiles(): Promise<void> {
    const expiredFiles = await this.videoService.findExpiredReadyFiles();

    for (const file of expiredFiles) {
      try {
        await this.storageService.deleteObject(file.key);
        await this.videoService.markDeleted(file.id);

        if (file.size) {
          await this.videoService.releaseReservation(
            file.sessionId,
            Number(file.size),
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to cleanup file ${file.id}: ${String(error)}`,
        );
      }
    }

    await this.videoService.reconcileStorageUsageFromDb();
    await this.videoService.promoteQueuedFiles();
  }
}
