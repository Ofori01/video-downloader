import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AppConfigService } from '../../config/app-config.service';
import { RedisService } from '../queue/redis.service';
import type { AvailableProfile } from './ytdlp.types';

interface ProfileSnapshotPayload {
  profiles: AvailableProfile[];
}

@Injectable()
export class ProfileSnapshotStoreService {
  constructor(
    private readonly config: AppConfigService,
    private readonly redisService: RedisService,
  ) {}

  async saveProfiles(
    sessionId: string,
    url: string,
    profiles: AvailableProfile[],
  ): Promise<void> {
    await this.redisService.raw.set(
      this.buildKey(sessionId, url),
      JSON.stringify({ profiles } satisfies ProfileSnapshotPayload),
      'EX',
      this.config.sessionWindowSeconds,
    );
  }

  async getProfile(
    sessionId: string,
    url: string,
    profileId: string,
  ): Promise<AvailableProfile | null> {
    const profiles = await this.getProfiles(sessionId, url);
    return (
      profiles.find(
        (profile) => profile.id === profileId || profile.format === profileId,
      ) ?? null
    );
  }

  private async getProfiles(
    sessionId: string,
    url: string,
  ): Promise<AvailableProfile[]> {
    const raw = await this.redisService.raw.get(this.buildKey(sessionId, url));
    if (!raw) {
      return [];
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      return [];
    }
    if (!this.isProfileSnapshotPayload(parsed)) {
      return [];
    }

    return parsed.profiles;
  }

  private buildKey(sessionId: string, url: string): string {
    const urlHash = createHash('sha256').update(url).digest('hex');
    return `video:profile-snapshot:${sessionId}:${urlHash}`;
  }

  private isProfileSnapshotPayload(
    value: unknown,
  ): value is ProfileSnapshotPayload {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const payload = value as Partial<ProfileSnapshotPayload>;
    return Array.isArray(payload.profiles);
  }
}
