import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileEntity } from '../../entities/file.entity';
import { QueueModule } from '../queue/queue.module';
import { SessionModule } from '../session/session.module';
import { StorageModule } from '../storage/storage.module';
import { VideoProcessor } from './video.processor';
import { VideoService } from './video.service';
import { YtDlpService } from './ytdlp.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([FileEntity]),
    QueueModule,
    SessionModule,
    StorageModule,
  ],
  providers: [VideoService, YtDlpService, VideoProcessor],
  exports: [VideoService],
})
export class VideoWorkerModule {}
