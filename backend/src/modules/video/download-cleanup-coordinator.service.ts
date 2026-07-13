import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { DownloadFileStore } from './download-file-store.service';
import { DownloadReservationService } from './download-reservation.service';

export interface ExpiredDownloadCleanupSummary {
  deleted: number;
  releasedBytes: number;
  sessionIds: string[];
}

@Injectable()
export class DownloadCleanupCoordinator {
  private readonly logger = new Logger(DownloadCleanupCoordinator.name);

  constructor(
    private readonly fileStore: DownloadFileStore,
    private readonly reservationService: DownloadReservationService,
    private readonly storageService: StorageService,
  ) {}

  async cleanupExpiredFiles(): Promise<ExpiredDownloadCleanupSummary> {
    const expiredFiles = await this.fileStore.findExpiredReadyFiles();
    let deleted = 0;
    let releasedBytes = 0;
    const sessionIds = new Set<string>();

    for (const file of expiredFiles) {
      try {
        await this.storageService.deleteObject(file.key);
        await this.fileStore.markDeleted(file.id);
        deleted += 1;

        if (file.size) {
          const size = Number(file.size);
          await this.reservationService.release(file.sessionId, size);
          releasedBytes += Number.isFinite(size) ? Math.max(0, size) : 0;
          sessionIds.add(file.sessionId);
        }
      } catch (error) {
        this.logger.error(
          `Failed to cleanup file ${file.id}: ${this.formatError(error)}`,
        );
      }
    }

    return { deleted, releasedBytes, sessionIds: [...sessionIds] };
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return `${error.name}: ${error.message}`;
    }

    return String(error);
  }
}
