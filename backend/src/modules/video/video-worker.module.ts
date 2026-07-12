import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from '../../config/app-config.module';
import { FileEntity } from '../../entities/file.entity';
import { QueueModule } from '../queue/queue.module';
import { SessionModule } from '../session/session.module';
import { StorageModule } from '../storage/storage.module';
import { DownloadCleanupCoordinator } from './download-cleanup-coordinator.service';
import { DownloadFileStore } from './download-file-store.service';
import { DownloadReservationService } from './download-reservation.service';
import { DownloadWorkerLifecycleService } from './download-worker-lifecycle.service';
import { QueuedDownloadPromotionService } from './queued-download-promotion.service';
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
  providers: [
    DownloadCleanupCoordinator,
    DownloadFileStore,
    DownloadReservationService,
    DownloadWorkerLifecycleService,
    QueuedDownloadPromotionService,
    YtDlpService,
    VideoProcessor,
  ],
  exports: [DownloadCleanupCoordinator],
})
export class VideoWorkerModule {}
