import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from '../../config/app-config.module';
import { FileEntity } from '../../entities/file.entity';
import { QueueModule } from '../queue/queue.module';
import { SessionModule } from '../session/session.module';
import { StorageModule } from '../storage/storage.module';
import { VideoController } from './video.controller';
import { VideoProcessor } from './video.processor';
import { VideoService } from './video.service';
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
  providers: [VideoService, VideoProcessor, YtDlpService],
  exports: [VideoService],
})
export class VideoModule {}
