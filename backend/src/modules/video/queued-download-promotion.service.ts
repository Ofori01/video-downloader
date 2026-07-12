import { Injectable, Logger } from '@nestjs/common';
import { QueueProducerService } from '../queue/queue.producer.service';
import { DownloadFileStore } from './download-file-store.service';
import { DownloadReservationService } from './download-reservation.service';

@Injectable()
export class QueuedDownloadPromotionService {
  private readonly logger = new Logger(QueuedDownloadPromotionService.name);

  constructor(
    private readonly fileStore: DownloadFileStore,
    private readonly queueProducer: QueueProducerService,
    private readonly reservationService: DownloadReservationService,
  ) {}

  async promoteQueuedFiles(limit = 25): Promise<number> {
    const queuedFiles = await this.fileStore.findQueuedDownloads(limit);
    let promoted = 0;

    for (const file of queuedFiles) {
      const estimatedSize = Number(file.size ?? 0);
      if (!Number.isFinite(estimatedSize) || estimatedSize <= 0) {
        await this.fileStore.markFailed(file.id, 'Invalid queued file size');
        continue;
      }

      const decision = await this.reservationService.evaluateAdmission(
        file.sessionId,
        estimatedSize,
      );

      if (decision.kind === 'reject') {
        await this.fileStore.markFailed(file.id, decision.message);
        continue;
      }

      if (decision.kind === 'queue') {
        break;
      }

      await this.reservationService.reserve(file.sessionId, estimatedSize);

      const claimed = await this.fileStore.claimQueuedDownload(file.id);
      if (!claimed) {
        await this.reservationService.release(file.sessionId, estimatedSize);
        continue;
      }

      try {
        const jobId = await this.queueProducer.enqueueDownloadJob({
          fileId: file.id,
          url: file.sourceUrl,
          sessionId: file.sessionId,
          reservedBytes: estimatedSize,
          profileId: file.profileId ?? undefined,
        });

        await this.attachQueueJob(file.id, jobId);
        promoted += 1;
      } catch (error) {
        await this.reservationService.release(file.sessionId, estimatedSize);
        await this.fileStore.markFailed(file.id, this.formatError(error));
      }
    }

    return promoted;
  }

  private async attachQueueJob(fileId: string, jobId: string): Promise<void> {
    try {
      await this.fileStore.attachQueueJob(fileId, jobId);
    } catch (error) {
      this.logger.error(
        `Failed to attach queue job ${jobId} to file ${fileId}: ${this.formatError(
          error,
        )}`,
      );
    }
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return `${error.name}: ${error.message}`;
    }

    return String(error);
  }
}
