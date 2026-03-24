import { Module } from '@nestjs/common';
import { CleanupService } from './cleanup.service';
import { StorageModule } from '../storage/storage.module';
import { VideoWorkerModule } from '../video/video-worker.module';

@Module({
  imports: [StorageModule, VideoWorkerModule],
  providers: [CleanupService],
})
export class CleanupModule {}
