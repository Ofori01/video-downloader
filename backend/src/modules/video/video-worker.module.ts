import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from '../../config/app-config.module';
import { FileEntity } from '../../entities/file.entity';
import { QueueModule } from '../queue/queue.module';
import { SessionModule } from '../session/session.module';
import { StorageModule } from '../storage/storage.module';
import { DownloadFormatResolver } from './download-format-resolver.service';
import { DownloadCleanupCoordinator } from './download-cleanup-coordinator.service';
import { DownloadFileStore } from './download-file-store.service';
import { DownloadProcessingRecoveryService } from './download-processing-recovery.service';
import { DownloadReservationMaintenanceService } from './download-reservation-maintenance.service';
import { DownloadReservationService } from './download-reservation.service';
import { DownloadWorkerLifecycleService } from './download-worker-lifecycle.service';
import { QueuedDownloadPromotionService } from './queued-download-promotion.service';
import { VideoProcessor } from './video.processor';
import { YtDlpMetadataClient } from './ytdlp-metadata-client.service';
import { YtDlpStreamClient } from './ytdlp-stream-client.service';
import { YtDlpStreamCommandBuilder } from './ytdlp-stream-command.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([FileEntity]),
    AppConfigModule,
    QueueModule,
    SessionModule,
    StorageModule,
  ],
  providers: [
    DownloadCleanupCoordinator,
    DownloadFormatResolver,
    DownloadFileStore,
    DownloadProcessingRecoveryService,
    DownloadReservationMaintenanceService,
    DownloadReservationService,
    DownloadWorkerLifecycleService,
    QueuedDownloadPromotionService,
    VideoProcessor,
    YtDlpMetadataClient,
    YtDlpStreamClient,
    YtDlpStreamCommandBuilder,
  ],
  exports: [DownloadReservationMaintenanceService],
})
export class VideoWorkerModule {}
