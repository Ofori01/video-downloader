import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DownloadCleanupCoordinator } from '../video/download-cleanup-coordinator.service';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private readonly downloadCleanup: DownloadCleanupCoordinator) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async cleanupExpiredFiles(): Promise<void> {
    const summary = await this.downloadCleanup.cleanupExpiredFiles();
    this.logger.log(
      `Expired download cleanup completed: deleted=${summary.deleted} promoted=${summary.promoted}`,
    );
  }
}
