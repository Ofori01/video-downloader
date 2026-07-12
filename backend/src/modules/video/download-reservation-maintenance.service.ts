import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import {
  DownloadCleanupCoordinator,
  ExpiredDownloadCleanupSummary,
} from './download-cleanup-coordinator.service';
import {
  DownloadProcessingRecoveryService,
  ProcessingRecoverySummary,
} from './download-processing-recovery.service';
import {
  DownloadReservationService,
  ReservationReconciliationSummary,
} from './download-reservation.service';
import { QueuedDownloadPromotionService } from './queued-download-promotion.service';

export interface DownloadMaintenanceSummary {
  recovery: ProcessingRecoverySummary;
  expiredCleanup: ExpiredDownloadCleanupSummary;
  reconciliation: ReservationReconciliationSummary;
  promoted: number;
}

@Injectable()
export class DownloadReservationMaintenanceService implements OnApplicationBootstrap {
  private readonly logger = new Logger(
    DownloadReservationMaintenanceService.name,
  );

  constructor(
    private readonly cleanupCoordinator: DownloadCleanupCoordinator,
    private readonly processingRecovery: DownloadProcessingRecoveryService,
    private readonly promotionService: QueuedDownloadPromotionService,
    private readonly reservationService: DownloadReservationService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const recovery =
      await this.processingRecovery.recoverStaleProcessingDownloads();
    const reconciliation =
      await this.reservationService.reconcileActiveReservationsFromDb(
        recovery.sessionIds,
      );

    this.logger.log(
      `Reservation startup reconciliation completed: storageBytes=${reconciliation.storageBytes} sessions=${reconciliation.sessions.length} staleFailed=${recovery.failed}`,
    );
  }

  async runScheduledMaintenance(): Promise<DownloadMaintenanceSummary> {
    const recovery =
      await this.processingRecovery.recoverStaleProcessingDownloads();
    const expiredCleanup = await this.cleanupCoordinator.cleanupExpiredFiles();
    const reconciliation =
      await this.reservationService.reconcileActiveReservationsFromDb([
        ...recovery.sessionIds,
        ...expiredCleanup.sessionIds,
      ]);
    const promoted = await this.promotionService.promoteQueuedFiles();

    return {
      recovery,
      expiredCleanup,
      reconciliation,
      promoted,
    };
  }
}
