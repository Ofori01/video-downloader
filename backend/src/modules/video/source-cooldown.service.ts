import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { RedisService } from '../queue/redis.service';
import {
  SourceSite,
  SourceSiteDetectorService,
} from './source-site-detector.service';
import type { YtDlpFailureClassification } from './ytdlp-error-classifier.service';

export interface SourceCooldownStatus {
  source: SourceSite;
  active: boolean;
}

@Injectable()
export class SourceCooldownService {
  constructor(
    private readonly config: AppConfigService,
    private readonly redis: RedisService,
    private readonly sourceDetector: SourceSiteDetectorService,
  ) {}

  async getStatus(url: string): Promise<SourceCooldownStatus> {
    const source = this.sourceDetector.detect(url);
    if (!this.usesCooldown(source)) {
      return { source, active: false };
    }

    const active = await this.redis.raw.exists(this.getCooldownKey(source));
    return { source, active: active === 1 };
  }

  async recordFailure(
    url: string,
    failure: YtDlpFailureClassification,
  ): Promise<void> {
    const source = this.sourceDetector.detect(url);
    if (source !== 'instagram' || failure.code !== 'source_rate_limited') {
      return;
    }

    await this.redis.raw.set(
      this.getCooldownKey(source),
      failure.code,
      'EX',
      this.config.instagramCooldownSeconds,
    );
  }

  private usesCooldown(source: SourceSite): boolean {
    return source === 'instagram';
  }

  private getCooldownKey(source: SourceSite): string {
    return `source:cooldown:${source}`;
  }
}
