import { Injectable } from '@nestjs/common';
import { RuntimeOperationsService } from '../runtime/runtime-operations.service';
import {
  RuntimeApiStatus,
  RuntimeHealthStatus,
} from '../runtime/runtime.types';

@Injectable()
export class HealthService {
  constructor(private readonly runtimeOperations: RuntimeOperationsService) {}

  async getHealthStatus(): Promise<RuntimeHealthStatus> {
    return this.runtimeOperations.getApiRuntimeStatus();
  }

  getApiProcessStatus(): RuntimeApiStatus {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }
}
