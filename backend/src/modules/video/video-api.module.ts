import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from '../../config/app-config.module';
import { FileEntity } from '../../entities/file.entity';
import { QueueModule } from '../queue/queue.module';
import { SessionModule } from '../session/session.module';
import { StorageModule } from '../storage/storage.module';
import { DownloadFileAccessService } from './download-file-access.service';
import { DownloadFileStore } from './download-file-store.service';
import { DownloadIntakeService } from './download-intake.service';
import { DownloadReservationService } from './download-reservation.service';
import { DownloadSizeEstimator } from './download-size-estimator.service';
import { ProfileCatalogueService } from './profile-catalogue.service';
import { ProfileSnapshotStoreService } from './profile-snapshot-store.service';
import { QueuedMetadataClient } from './queued-metadata-client.service';
import { SourceCooldownService } from './source-cooldown.service';
import { SourceProfileCacheService } from './source-profile-cache.service';
import { SourceSiteDetectorService } from './source-site-detector.service';
import { VideoController } from './video.controller';
import { VIDEO_METADATA_CLIENT } from './video-metadata-client';
import { YtDlpFormatSizeService } from './ytdlp-format-size.service';

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
    DownloadFileAccessService,
    DownloadFileStore,
    DownloadIntakeService,
    DownloadReservationService,
    DownloadSizeEstimator,
    ProfileCatalogueService,
    ProfileSnapshotStoreService,
    QueuedMetadataClient,
    SourceCooldownService,
    SourceProfileCacheService,
    SourceSiteDetectorService,
    YtDlpFormatSizeService,
    {
      provide: VIDEO_METADATA_CLIENT,
      useExisting: QueuedMetadataClient,
    },
  ],
})
export class VideoApiModule {}
