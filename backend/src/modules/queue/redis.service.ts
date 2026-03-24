import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(private readonly config: AppConfigService) {
    this.client = new Redis(this.config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });
  }

  get raw(): Redis {
    return this.client;
  }

  async getNumber(key: string): Promise<number> {
    const value = await this.client.get(key);
    return value ? Number(value) : 0;
  }

  async incrementBy(key: string, by: number): Promise<number> {
    return this.client.incrby(key, by);
  }

  async decrementBy(key: string, by: number): Promise<number> {
    return this.client.decrby(key, by);
  }

  async incrementWithWindow(
    key: string,
    windowSeconds: number,
  ): Promise<number> {
    const tx = this.client.multi();
    tx.incr(key);
    tx.expire(key, windowSeconds, 'NX');

    const result = await tx.exec();
    const value = result?.[0]?.[1];
    return typeof value === 'number' ? value : Number(value ?? 0);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
