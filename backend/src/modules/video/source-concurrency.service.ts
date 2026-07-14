import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppConfigService } from '../../config/app-config.service';
import { RedisService } from '../queue/redis.service';
import {
  SourceSite,
  SourceSiteDetectorService,
} from './source-site-detector.service';

export interface SourceSlotLease {
  source: SourceSite;
  acquired: boolean;
  release(): Promise<void>;
}

@Injectable()
export class SourceConcurrencyService {
  constructor(
    private readonly config: AppConfigService,
    private readonly redis: RedisService,
    private readonly sourceDetector: SourceSiteDetectorService,
  ) {}

  async acquireSlot(url: string): Promise<SourceSlotLease> {
    const source = this.sourceDetector.detect(url);
    if (!this.usesSlot(source)) {
      return this.createNoopLease(source);
    }

    const key = this.getSlotKey(source);
    const token = randomUUID();
    const result = await this.redis.raw.set(
      key,
      token,
      'EX',
      this.config.instagramSourceLockTtlSeconds,
      'NX',
    );

    if (result !== 'OK') {
      return {
        source,
        acquired: false,
        release: () => Promise.resolve(),
      };
    }

    return {
      source,
      acquired: true,
      release: async () => {
        await this.redis.raw.eval(
          `
          if redis.call('GET', KEYS[1]) == ARGV[1] then
            return redis.call('DEL', KEYS[1])
          end
          return 0
          `,
          1,
          key,
          token,
        );
      },
    };
  }

  private usesSlot(source: SourceSite): boolean {
    return source === 'instagram';
  }

  private createNoopLease(source: SourceSite): SourceSlotLease {
    return {
      source,
      acquired: true,
      release: () => Promise.resolve(),
    };
  }

  private getSlotKey(source: SourceSite): string {
    return `source:slot:${source}`;
  }
}
