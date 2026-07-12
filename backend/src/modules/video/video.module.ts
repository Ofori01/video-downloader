import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from '../../config/app-config.module';
import { FileEntity } from '../../entities/file.entity';
import { QueueModule } from '../queue/queue.module';
import { SessionModule } from '../session/session.module';
import { StorageModule } from '../storage/storage.module';
import { DownloadCleanupCoordinator } from './download-cleanup-coordinator.service';
import { DownloadFileAccessService } from './download-file-access.service';
import { DownloadFileStore } from './download-file-store.service';
import { DownloadIntakeService } from './download-intake.service';
import { DownloadReservationService } from './download-reservation.service';
import { DownloadSizeEstimator } from './download-size-estimator.service';
import { DownloadWorkerLifecycleService } from './download-worker-lifecycle.service';
import { QueuedDownloadPromotionService } from './queued-download-promotion.service';
import { VideoController } from './video.controller';
import { VideoProcessor } from './video.processor';
import { YtDlpService } from './ytdlp.service';

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
    DownloadFileAccessService,
    DownloadFileStore,
    DownloadIntakeService,
    DownloadReservationService,
    DownloadSizeEstimator,
    DownloadWorkerLifecycleService,
    QueuedDownloadPromotionService,
    VideoProcessor,
    YtDlpService,
  ],
  exports: [
    DownloadCleanupCoordinator,
    DownloadFileAccessService,
    DownloadIntakeService,
    DownloadWorkerLifecycleService,
  ],
})
export class VideoModule {}
