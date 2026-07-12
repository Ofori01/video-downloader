import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AppConfigModule } from '../../config/app-config.module';
import { AppConfigService } from '../../config/app-config.service';
import { QueueDiagnosticsService } from './queue-diagnostics.service';
import { QueueProducerService } from './queue.producer.service';
import { VIDEO_QUEUE_NAME } from './queue-name';
import { RedisService } from './redis.service';

@Module({
  imports: [
    AppConfigModule,
    BullModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        connection: {
          url: config.redisUrl,
        },
      }),
    }),
    BullModule.registerQueueAsync({
      name: VIDEO_QUEUE_NAME,
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: () => ({
        name: VIDEO_QUEUE_NAME,
      }),
    }),
  ],
  providers: [QueueDiagnosticsService, QueueProducerService, RedisService],
  exports: [
    BullModule,
    QueueDiagnosticsService,
    QueueProducerService,
    RedisService,
  ],
})
export class QueueModule {}
