import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { DownloadFileStore } from './download-file-store.service';
import { DownloadReservationService } from './download-reservation.service';

@Injectable()
export class DownloadWorkerLifecycleService {
  constructor(
    private readonly config: AppConfigService,
    private readonly fileStore: DownloadFileStore,
    private readonly reservationService: DownloadReservationService,
  ) {}

  async markReady(fileId: string, key: string, size: number): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.config.fileTtlSeconds * 1000,
    );

    await this.fileStore.markReady(fileId, key, size, expiresAt);
  }

  async markFailed(fileId: string, reason: string): Promise<void> {
    await this.fileStore.markFailed(fileId, reason);
  }

  async releaseReservation(sessionId: string, bytes: number): Promise<void> {
    await this.reservationService.release(sessionId, bytes);
  }

  async reconcileReservationForCompletedFile(
    sessionId: string,
    reservedBytes: number,
    actualBytes: number,
  ): Promise<void> {
    await this.reservationService.reconcileCompleted(
      sessionId,
      reservedBytes,
      actualBytes,
    );
  }
}
