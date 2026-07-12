import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DownloadReservationMaintenanceService } from '../video/download-reservation-maintenance.service';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    private readonly reservationMaintenance: DownloadReservationMaintenanceService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async cleanupExpiredFiles(): Promise<void> {
    const summary = await this.reservationMaintenance.runScheduledMaintenance();
    this.logger.log(
      `Download maintenance completed: staleFailed=${summary.recovery.failed} expiredDeleted=${summary.expiredCleanup.deleted} promoted=${summary.promoted} storageBytes=${summary.reconciliation.storageBytes}`,
    );
  }
}
