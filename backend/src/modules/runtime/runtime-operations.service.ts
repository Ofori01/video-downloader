import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { QueueDiagnosticsService } from '../queue/queue-diagnostics.service';
import { RedisService } from '../queue/redis.service';
import { RuntimeCheck, RuntimeHealthStatus } from './runtime.types';

@Injectable()
export class RuntimeOperationsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
    private readonly queueDiagnostics: QueueDiagnosticsService,
  ) {}

  async getApiRuntimeStatus(): Promise<RuntimeHealthStatus> {
    const [postgres, redis, queue, worker] = await Promise.all([
      this.checkPostgres(),
      this.checkRedis(),
      this.checkQueue(),
      this.checkWorker(),
    ]);

    const checks = {
      postgres,
      redis,
      queue,
      worker,
    };

    return {
      status: Object.values(checks).every((check) => check.status === 'up')
        ? 'ok'
        : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  private async checkPostgres(): Promise<RuntimeCheck> {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'up' };
    } catch (error) {
      return { status: 'down', details: String(error) };
    }
  }

  private async checkRedis(): Promise<RuntimeCheck> {
    try {
      const response = await this.redisService.raw.ping();
      if (response !== 'PONG') {
        return {
          status: 'down',
          details: 'Unexpected redis ping response',
        };
      }

      return { status: 'up' };
    } catch (error) {
      return { status: 'down', details: String(error) };
    }
  }

  private async checkQueue(): Promise<RuntimeCheck> {
    try {
      const metrics = await this.queueDiagnostics.getQueueMetrics();
      return {
        status: 'up',
        details: `waiting=${metrics.waiting} active=${metrics.active} failed=${metrics.failed}`,
      };
    } catch (error) {
      return { status: 'down', details: String(error) };
    }
  }

  private async checkWorker(): Promise<RuntimeCheck> {
    try {
      const workers = await this.queueDiagnostics.getWorkerCount();
      if (workers < 1) {
        return {
          status: 'down',
          details: 'No BullMQ workers connected to the video queue',
        };
      }

      return {
        status: 'up',
        details: `${workers} worker${workers === 1 ? '' : 's'} connected`,
      };
    } catch (error) {
      return { status: 'down', details: String(error) };
    }
  }
}
