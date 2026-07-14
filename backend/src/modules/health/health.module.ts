import { Module } from '@nestjs/common';
import { RuntimeOperationsModule } from '../runtime/runtime-operations.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { StatusController } from './status.controller';

@Module({
  imports: [RuntimeOperationsModule],
  controllers: [HealthController, StatusController],
  providers: [HealthService],
})
export class HealthModule {}
