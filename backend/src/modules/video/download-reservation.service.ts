import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { STORAGE_USED_KEY } from '../queue/queue.constants';
import { RedisService } from '../queue/redis.service';
import { SessionService } from '../session/session.service';
import { DownloadFileStore } from './download-file-store.service';

export type DownloadAdmissionDecision =
  | { kind: 'process' }
  | { kind: 'queue'; reason: 'storage_capacity' }
  | {
      kind: 'reject';
      reason:
        | 'invalid_size'
        | 'max_file_size'
        | 'session_file_size'
        | 'session_quota';
      message: string;
    };

export interface SessionReservationReconciliation {
  sessionId: string;
  bytes: number;
}

export interface ReservationReconciliationSummary {
  storageBytes: number;
  sessions: SessionReservationReconciliation[];
}

@Injectable()
export class DownloadReservationService {
  constructor(
    private readonly config: AppConfigService,
    private readonly fileStore: DownloadFileStore,
    private readonly redisService: RedisService,
    private readonly sessionService: SessionService,
  ) {}

  async evaluateAdmission(
    sessionId: string,
    estimatedSize: number,
  ): Promise<DownloadAdmissionDecision> {
    const bytes = this.normalizeBytes(estimatedSize);
    if (bytes <= 0) {
      return {
        kind: 'reject',
        reason: 'invalid_size',
        message: 'Unable to estimate file size',
      };
    }

    if (bytes > this.config.maxFileBytes) {
      return {
        kind: 'reject',
        reason: 'max_file_size',
        message: 'Requested file exceeds max file size',
      };
    }

    if (bytes > this.config.sessionMaxBytes) {
      return {
        kind: 'reject',
        reason: 'session_file_size',
        message: 'Requested file exceeds per-session storage quota',
      };
    }

    const [sessionBytes, storageUsed] = await Promise.all([
      this.sessionService.getSessionBytes(sessionId),
      this.redisService.getNumber(STORAGE_USED_KEY),
    ]);

    const effectiveSessionBytes = await this.reconcileSessionBytesIfStale(
      sessionId,
      sessionBytes,
      bytes,
    );

    if (effectiveSessionBytes + bytes > this.config.sessionMaxBytes) {
      return {
        kind: 'reject',
        reason: 'session_quota',
        message: 'Session storage quota exceeded',
      };
    }

    if (storageUsed + bytes > this.config.maxStorageBytes) {
      return { kind: 'queue', reason: 'storage_capacity' };
    }

    return { kind: 'process' };
  }

  async reserve(sessionId: string, bytes: number): Promise<void> {
    const normalizedBytes = this.normalizeBytes(bytes);
    if (normalizedBytes <= 0) {
      return;
    }

    await Promise.all([
      this.sessionService.reserveSessionBytes(sessionId, normalizedBytes),
      this.redisService.incrementBy(STORAGE_USED_KEY, normalizedBytes),
    ]);
  }

  async release(sessionId: string, bytes: number): Promise<void> {
    const normalizedBytes = this.normalizeBytes(bytes);
    if (normalizedBytes <= 0) {
      return;
    }

    await Promise.all([
      this.sessionService.releaseSessionBytes(sessionId, normalizedBytes),
      this.redisService.decrementBy(STORAGE_USED_KEY, normalizedBytes),
    ]);
  }

  async reconcileCompleted(
    sessionId: string,
    reservedBytes: number,
    actualBytes: number,
  ): Promise<void> {
    const reserved = this.normalizeBytes(reservedBytes);
    const actual = this.normalizeBytes(actualBytes);

    if (reserved === actual) {
      return;
    }

    if (reserved > actual) {
      await this.release(sessionId, reserved - actual);
      return;
    }

    await this.reserve(sessionId, actual - reserved);
  }

  async reconcileStorageUsageFromDb(): Promise<number> {
    const total = await this.fileStore.getActiveStorageBytes();
    await this.redisService.setNumber(STORAGE_USED_KEY, total);
    return total;
  }

  async reconcileSessionUsageFromDb(
    sessionId: string,
  ): Promise<SessionReservationReconciliation> {
    const bytes = await this.fileStore.getActiveSessionBytes(sessionId);
    await this.sessionService.setSessionBytes(sessionId, bytes);
    return { sessionId, bytes };
  }

  async reconcileActiveReservationsFromDb(
    additionalSessionIds: string[] = [],
  ): Promise<ReservationReconciliationSummary> {
    const storageBytes = await this.reconcileStorageUsageFromDb();
    const activeSessionIds =
      await this.fileStore.getActiveReservationSessionIds();
    const sessionIds = [
      ...new Set([...activeSessionIds, ...additionalSessionIds]),
    ];

    const sessions = await Promise.all(
      sessionIds.map((sessionId) =>
        this.reconcileSessionUsageFromDb(sessionId),
      ),
    );

    return { storageBytes, sessions };
  }

  private async reconcileSessionBytesIfStale(
    sessionId: string,
    sessionBytes: number,
    requestedBytes: number,
  ): Promise<number> {
    if (sessionBytes + requestedBytes <= this.config.sessionMaxBytes) {
      return sessionBytes;
    }

    const dbSessionBytes =
      await this.fileStore.getActiveSessionBytes(sessionId);
    if (dbSessionBytes !== sessionBytes) {
      await this.sessionService.setSessionBytes(sessionId, dbSessionBytes);
    }

    return dbSessionBytes;
  }

  private normalizeBytes(value: number): number {
    return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
  }
}
