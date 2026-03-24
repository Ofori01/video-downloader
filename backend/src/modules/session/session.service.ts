import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppConfigService } from '../../config/app-config.service';
import { SessionEntity } from '../../entities/session.entity';
import { RedisService } from '../queue/redis.service';

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(SessionEntity)
    private readonly sessionRepository: Repository<SessionEntity>,
    private readonly redisService: RedisService,
    private readonly config: AppConfigService,
  ) {}

  async touchSession(sessionId: string): Promise<void> {
    await this.sessionRepository
      .createQueryBuilder()
      .insert()
      .into(SessionEntity)
      .values({ id: sessionId })
      .orIgnore()
      .execute();

    await this.sessionRepository.increment(
      { id: sessionId },
      'requestCount',
      1,
    );

    await this.sessionRepository.update(
      { id: sessionId },
      { lastSeenAt: new Date() },
    );
  }

  async incrementSessionJobs(sessionId: string): Promise<number> {
    const key = `session:${sessionId}:jobs`;
    return this.redisService.incrementWithWindow(
      key,
      this.config.sessionWindowSeconds,
    );
  }

  async getSessionBytes(sessionId: string): Promise<number> {
    return this.redisService.getNumber(`session:${sessionId}:bytes_used`);
  }

  async reserveSessionBytes(sessionId: string, bytes: number): Promise<number> {
    return this.redisService.incrementBy(
      `session:${sessionId}:bytes_used`,
      bytes,
    );
  }

  async releaseSessionBytes(sessionId: string, bytes: number): Promise<number> {
    return this.redisService.decrementBy(
      `session:${sessionId}:bytes_used`,
      bytes,
    );
  }

  async incrementSessionDownloads(sessionId: string): Promise<number> {
    return this.redisService.incrementBy(`session:${sessionId}:downloads`, 1);
  }
}
