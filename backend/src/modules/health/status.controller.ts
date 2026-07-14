import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('system/status')
export class StatusController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getStatus() {
    return this.healthService.getApiProcessStatus();
  }
}
