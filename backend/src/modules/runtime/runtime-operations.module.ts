import { Module } from '@nestjs/common';
import { AppConfigModule } from '../../config/app-config.module';
import { QueueModule } from '../queue/queue.module';
import { RuntimeBinaryReadinessService } from './runtime-binary-readiness.service';
import { RuntimeOperationsService } from './runtime-operations.service';

@Module({
  imports: [AppConfigModule, QueueModule],
  providers: [RuntimeBinaryReadinessService, RuntimeOperationsService],
  exports: [RuntimeOperationsService],
})
export class RuntimeOperationsModule {}
