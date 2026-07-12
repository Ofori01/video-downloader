import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from '../../config/app-config.module';
import { FileEntity } from '../../entities/file.entity';
import { QueueModule } from '../queue/queue.module';
import { SessionModule } from '../session/session.module';
import { StorageModule } from '../storage/storage.module';
import { DownloadCleanupCoordinator } from './download-cleanup-coordinator.service';
import { DownloadFormatResolver } from './download-format-resolver.service';
import { DownloadFileAccessService } from './download-file-access.service';
import { DownloadFileStore } from './download-file-store.service';
import { DownloadIntakeService } from './download-intake.service';
import { DownloadProcessingRecoveryService } from './download-processing-recovery.service';
import { DownloadReservationMaintenanceService } from './download-reservation-maintenance.service';
import { DownloadReservationService } from './download-reservation.service';
import { DownloadSizeEstimator } from './download-size-estimator.service';
import { DownloadWorkerLifecycleService } from './download-worker-lifecycle.service';
import { ProfileCatalogueService } from './profile-catalogue.service';
import { QueuedDownloadPromotionService } from './queued-download-promotion.service';
import { VideoController } from './video.controller';
import { VideoProcessor } from './video.processor';
import { YtDlpFormatSizeService } from './ytdlp-format-size.service';
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
  controllers: [VideoController],
  providers: [
    DownloadCleanupCoordinator,
    DownloadFormatResolver,
    DownloadFileAccessService,
    DownloadFileStore,
    DownloadIntakeService,
    DownloadProcessingRecoveryService,
    DownloadReservationMaintenanceService,
    DownloadReservationService,
    DownloadSizeEstimator,
    DownloadWorkerLifecycleService,
    ProfileCatalogueService,
    QueuedDownloadPromotionService,
    VideoProcessor,
    YtDlpFormatSizeService,
    YtDlpMetadataClient,
    YtDlpStreamClient,
    YtDlpStreamCommandBuilder,
  ],
  exports: [
    DownloadCleanupCoordinator,
    DownloadFileAccessService,
    DownloadIntakeService,
    DownloadReservationMaintenanceService,
    DownloadWorkerLifecycleService,
  ],
})
export class VideoModule {}
