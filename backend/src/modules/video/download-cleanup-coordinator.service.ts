import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { DownloadFileStore } from './download-file-store.service';
import { DownloadReservationService } from './download-reservation.service';
import { QueuedDownloadPromotionService } from './queued-download-promotion.service';

export interface DownloadCleanupSummary {
  deleted: number;
  promoted: number;
}

@Injectable()
export class DownloadCleanupCoordinator {
  private readonly logger = new Logger(DownloadCleanupCoordinator.name);

  constructor(
    private readonly fileStore: DownloadFileStore,
    private readonly promotionService: QueuedDownloadPromotionService,
    private readonly reservationService: DownloadReservationService,
    private readonly storageService: StorageService,
  ) {}

  async cleanupExpiredFiles(): Promise<DownloadCleanupSummary> {
    const expiredFiles = await this.fileStore.findExpiredReadyFiles();
    let deleted = 0;

    for (const file of expiredFiles) {
      try {
        await this.storageService.deleteObject(file.key);
        await this.fileStore.markDeleted(file.id);
        deleted += 1;

        if (file.size) {
          await this.reservationService.release(
            file.sessionId,
            Number(file.size),
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to cleanup file ${file.id}: ${this.formatError(error)}`,
        );
      }
    }

    await this.reservationService.reconcileStorageUsageFromDb();
    const promoted = await this.promotionService.promoteQueuedFiles();

    return { deleted, promoted };
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return `${error.name}: ${error.message}`;
    }

    return String(error);
  }
}
