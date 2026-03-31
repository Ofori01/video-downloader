import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppConfigModule } from './config/app-config.module';
import { envValidationSchema } from './config/env.validation';
import { DatabaseModule } from './database.module';
import { CleanupModule } from './modules/cleanup/cleanup.module';
import { QueueModule } from './modules/queue/queue.module';
import { SessionModule } from './modules/session/session.module';
import { StorageModule } from './modules/storage/storage.module';
import { VideoWorkerModule } from './modules/video/video-worker.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    ScheduleModule.forRoot(),
    AppConfigModule,
    DatabaseModule,
    QueueModule,
    SessionModule,
    StorageModule,
    VideoWorkerModule,
    CleanupModule,
  ],
})
export class WorkerModule {}
