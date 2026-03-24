import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { QueueProducerService } from '../queue/queue.producer.service';
import { RedisService } from '../queue/redis.service';

type CheckStatus = 'up' | 'down';

type ServiceCheck = {
  status: CheckStatus;
  details?: string;
};

@Injectable()
export class HealthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
    private readonly queueProducer: QueueProducerService,
  ) {}

  async getHealthStatus(): Promise<{
    status: 'ok' | 'degraded';
    timestamp: string;
    checks: {
      postgres: ServiceCheck;
      redis: ServiceCheck;
      queue: ServiceCheck;
    };
  }> {
    const [postgres, redis, queue] = await Promise.all([
      this.checkPostgres(),
      this.checkRedis(),
      this.checkQueue(),
    ]);

    const status =
      postgres.status === 'up' && redis.status === 'up' && queue.status === 'up'
        ? 'ok'
        : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      checks: {
        postgres,
        redis,
        queue,
      },
    };
  }

  private async checkPostgres(): Promise<ServiceCheck> {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'up' };
    } catch (error) {
      return { status: 'down', details: String(error) };
    }
  }

  private async checkRedis(): Promise<ServiceCheck> {
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

  private async checkQueue(): Promise<ServiceCheck> {
    try {
      await this.queueProducer.getQueueMetrics();
      return { status: 'up' };
    } catch (error) {
      return { status: 'down', details: String(error) };
    }
  }
}
