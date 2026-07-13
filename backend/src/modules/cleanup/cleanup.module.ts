import { Module } from '@nestjs/common';
import { CleanupService } from './cleanup.service';
import { VideoWorkerModule } from '../video/video-worker.module';

@Module({
  imports: [VideoWorkerModule],
  providers: [CleanupService],
})
export class CleanupModule {}
