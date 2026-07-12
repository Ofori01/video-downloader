import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { RuntimeOperationsService } from './runtime-operations.service';

@Module({
  imports: [QueueModule],
  providers: [RuntimeOperationsService],
  exports: [RuntimeOperationsService],
})
export class RuntimeOperationsModule {}
