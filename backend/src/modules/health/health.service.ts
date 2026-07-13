import { Injectable } from '@nestjs/common';
import { RuntimeOperationsService } from '../runtime/runtime-operations.service';
import { RuntimeHealthStatus } from '../runtime/runtime.types';

@Injectable()
export class HealthService {
  constructor(private readonly runtimeOperations: RuntimeOperationsService) {}

  async getHealthStatus(): Promise<RuntimeHealthStatus> {
    return this.runtimeOperations.getApiRuntimeStatus();
  }
}
