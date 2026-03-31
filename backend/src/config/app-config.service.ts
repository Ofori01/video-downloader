import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  get nodeEnv(): string {
    return this.getOrThrow('NODE_ENV');
  }

  get port(): number {
    return this.getNumber('PORT');
  }

  get frontendOrigin(): string {
    return this.getOrThrow('FRONTEND_ORIGIN');
  }

  get databaseUrl(): string {
    return this.getOrThrow('DATABASE_URL');
  }

  get redisUrl(): string {
    return this.getOrThrow('REDIS_URL');
  }

  get queueName(): string {
    return this.getOrThrow('QUEUE_NAME');
  }

  get workerConcurrency(): number {
    return this.getNumber('WORKER_CONCURRENCY');
  }

  get sessionCookieName(): string {
    return this.getOrThrow('SESSION_COOKIE_NAME');
  }

  get sessionCookieMaxAgeSeconds(): number {
    return this.getNumber('SESSION_COOKIE_MAX_AGE_SECONDS');
  }

  get sessionCookieSecure(): boolean {
    return this.getBoolean('SESSION_COOKIE_SECURE');
  }

  get sessionMaxJobs(): number {
    return this.getNumber('SESSION_MAX_JOBS');
  }

  get sessionWindowSeconds(): number {
    return this.getNumber('SESSION_WINDOW_SECONDS');
  }

  get sessionMaxBytes(): number {
    return this.getNumber('SESSION_MAX_BYTES');
  }

  get maxFileBytes(): number {
    return this.getNumber('MAX_FILE_BYTES');
  }

  get maxStorageBytes(): number {
    return this.getNumber('MAX_STORAGE_BYTES');
  }

  get fileTtlSeconds(): number {
    return Math.min(this.getNumber('FILE_TTL_SECONDS'), 3600);
  }

  get signedUrlTtlSeconds(): number {
    return this.getNumber('SIGNED_URL_TTL_SECONDS');
  }

  get enableNewRequests(): boolean {
    return this.getBoolean('ENABLE_NEW_REQUESTS');
  }

  get r2Endpoint(): string {
    return this.getOrThrow('R2_ENDPOINT');
  }

  get r2Region(): string {
    return this.getOrThrow('R2_REGION');
  }

  get r2Bucket(): string {
    return this.getOrThrow('R2_BUCKET');
  }

  get r2AccessKeyId(): string {
    return this.getOrThrow('R2_ACCESS_KEY_ID');
  }

  get r2SecretAccessKey(): string {
    return this.getOrThrow('R2_SECRET_ACCESS_KEY');
  }

  get ytDlpBinaryPath(): string | undefined {
    return this.configService.get<string>('YTDLP_BINARY_PATH');
  }

  get ffmpegBinaryPath(): string | undefined {
    return this.configService.get<string>('FFMPEG_BINARY_PATH');
  }

  private getOrThrow(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) {
      throw new Error(`Missing required environment variable: ${key}`);
    }

    return value;
  }

  private getNumber(key: string): number {
    const value = this.configService.get<number>(key);
    if (typeof value !== 'number' || Number.isNaN(value)) {
      throw new Error(`Invalid numeric environment variable: ${key}`);
    }

    return value;
  }

  private getBoolean(key: string): boolean {
    const value = this.configService.get<boolean>(key);
    if (typeof value !== 'boolean') {
      throw new Error(`Invalid boolean environment variable: ${key}`);
    }

    return value;
  }
}
