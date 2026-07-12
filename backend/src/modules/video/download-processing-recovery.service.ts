import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { FileEntity } from '../../entities/file.entity';
import { DownloadFileStore } from './download-file-store.service';
import { DownloadReservationService } from './download-reservation.service';

export interface ProcessingRecoverySummary {
  staleCutoff: Date;
  inspected: number;
  failed: number;
  releasedBytes: number;
  sessionIds: string[];
}

const DEFAULT_RECOVERY_LIMIT = 100;

@Injectable()
export class DownloadProcessingRecoveryService {
  private readonly logger = new Logger(DownloadProcessingRecoveryService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly fileStore: DownloadFileStore,
    private readonly reservationService: DownloadReservationService,
  ) {}

  async recoverStaleProcessingDownloads(
    now = new Date(),
    limit = DEFAULT_RECOVERY_LIMIT,
  ): Promise<ProcessingRecoverySummary> {
    const staleCutoff = new Date(
      now.getTime() - this.config.processingStaleAfterSeconds * 1000,
    );
    const staleFiles = await this.fileStore.findStaleProcessingDownloads(
      staleCutoff,
      limit,
    );
    const sessionIds = new Set<string>();
    let failed = 0;
    let releasedBytes = 0;

    for (const file of staleFiles) {
      const failedThisFile = await this.fileStore.failProcessingDownload(
        file.id,
        `Processing exceeded ${this.config.processingStaleAfterSeconds}s without completion`,
      );

      if (!failedThisFile) {
        continue;
      }

      failed += 1;
      sessionIds.add(file.sessionId);

      const reservedBytes = this.getReservedBytes(file);
      if (reservedBytes > 0) {
        await this.reservationService.release(file.sessionId, reservedBytes);
        releasedBytes += reservedBytes;
      }
    }

    const summary = {
      staleCutoff,
      inspected: staleFiles.length,
      failed,
      releasedBytes,
      sessionIds: [...sessionIds],
    };

    if (summary.failed > 0) {
      this.logger.warn(
        `Recovered stale processing downloads: failed=${summary.failed} releasedBytes=${summary.releasedBytes}`,
      );
    }

    return summary;
  }

  private getReservedBytes(file: FileEntity): number {
    const parsed = Number(file.size ?? 0);
    return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
  }
}
