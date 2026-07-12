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

  async setNumber(key: string, value: number): Promise<void> {
    await this.client.set(key, value);
  }

  async decrementBy(key: string, by: number): Promise<number> {
    const result = await this.client.eval(
      `
      local current = tonumber(redis.call('GET', KEYS[1]) or '0')
      local decrement = tonumber(ARGV[1])
      local next_value = current - decrement
      if next_value < 0 then
        next_value = 0
      end
      redis.call('SET', KEYS[1], tostring(next_value))
      return next_value
      `,
      1,
      key,
      String(Math.max(0, Math.trunc(by))),
    );

    return Number(result);
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
