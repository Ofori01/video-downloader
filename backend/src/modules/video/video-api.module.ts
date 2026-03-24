import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileEntity } from '../../entities/file.entity';
import { QueueModule } from '../queue/queue.module';
import { SessionModule } from '../session/session.module';
import { StorageModule } from '../storage/storage.module';
import { VideoController } from './video.controller';
import { VideoService } from './video.service';
import { YtDlpService } from './ytdlp.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([FileEntity]),
    QueueModule,
    SessionModule,
    StorageModule,
  ],
  controllers: [VideoController],
  providers: [VideoService, YtDlpService],
  exports: [VideoService],
})
export class VideoApiModule {}
