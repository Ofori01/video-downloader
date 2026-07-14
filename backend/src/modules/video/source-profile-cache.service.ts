import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AppConfigService } from '../../config/app-config.service';
import { RedisService } from '../queue/redis.service';
import { SourceSiteDetectorService } from './source-site-detector.service';
import type { AvailableProfile } from './ytdlp.types';

interface SourceProfileCachePayload {
  profiles: AvailableProfile[];
}

@Injectable()
export class SourceProfileCacheService {
  constructor(
    private readonly config: AppConfigService,
    private readonly redis: RedisService,
    private readonly sourceDetector: SourceSiteDetectorService,
  ) {}

  async getProfiles(url: string): Promise<AvailableProfile[] | null> {
    const raw = await this.redis.raw.get(this.getCacheKey(url));
    if (!raw) {
      return null;
    }

    try {
      const payload = JSON.parse(raw) as Partial<SourceProfileCachePayload>;
      return Array.isArray(payload.profiles) ? payload.profiles : null;
    } catch {
      return null;
    }
  }

  async saveProfiles(url: string, profiles: AvailableProfile[]): Promise<void> {
    await this.redis.raw.set(
      this.getCacheKey(url),
      JSON.stringify({ profiles }),
      'EX',
      this.config.sourceProfileCacheTtlSeconds,
    );
  }

  private getCacheKey(url: string): string {
    const source = this.sourceDetector.detect(url);
    const digest = createHash('sha256').update(url).digest('hex');
    return `source:profiles:${source}:${digest}`;
  }
}
