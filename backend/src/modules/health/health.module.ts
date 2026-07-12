import { Module } from '@nestjs/common';
import { RuntimeOperationsModule } from '../runtime/runtime-operations.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [RuntimeOperationsModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
