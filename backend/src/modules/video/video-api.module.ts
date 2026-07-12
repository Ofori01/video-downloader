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
import { VideoController } from './video.controller';
import { YtDlpFormatSizeService } from './ytdlp-format-size.service';
import { YtDlpMetadataClient } from './ytdlp-metadata-client.service';

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
    YtDlpFormatSizeService,
    YtDlpMetadataClient,
  ],
})
export class VideoApiModule {}
