import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { FileStatus } from '../../entities/file.entity';
import { QueueProducerService } from '../queue/queue.producer.service';
import { SessionService } from '../session/session.service';
import { DownloadFileStore } from './download-file-store.service';
import {
  DownloadAdmissionDecision,
  DownloadReservationService,
} from './download-reservation.service';
import {
  coerceDownloadOutput,
  DEFAULT_VIDEO_OUTPUT,
  DownloadOutput,
} from './download-output';
import { DownloadSizeEstimator } from './download-size-estimator.service';
import { ProfileCatalogueService } from './profile-catalogue.service';
import type { AvailableProfile } from './ytdlp.types';

export interface SubmitDownloadCommand {
  url: string;
  sessionId: string;
  profileId?: string;
}

export interface SubmitDownloadResult {
  fileId: string;
  jobId: string | null;
  estimatedSize: number;
  status: FileStatus;
}

@Injectable()
export class DownloadIntakeService {
  private readonly logger = new Logger(DownloadIntakeService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly fileStore: DownloadFileStore,
    private readonly profileCatalogue: ProfileCatalogueService,
    private readonly queueProducer: QueueProducerService,
    private readonly reservationService: DownloadReservationService,
    private readonly sessionService: SessionService,
    private readonly sizeEstimator: DownloadSizeEstimator,
  ) {}

  async submit(command: SubmitDownloadCommand): Promise<SubmitDownloadResult> {
    if (!this.config.enableNewRequests) {
      throw new ServiceUnavailableException(
        'New requests are currently disabled',
      );
    }

    const sessionJobs = await this.sessionService.incrementSessionJobs(
      command.sessionId,
    );
    if (sessionJobs > this.config.sessionMaxJobs) {
      throw new ForbiddenException('Session has exceeded job rate limit');
    }

    const { estimatedSize, output } =
      await this.resolveDownloadSelection(command);
    const decision = await this.reservationService.evaluateAdmission(
      command.sessionId,
      estimatedSize,
    );

    if (decision.kind === 'reject') {
      this.throwAdmissionRejection(decision);
    }

    if (decision.kind === 'queue') {
      const file = await this.fileStore.createQueuedDownload({
        url: command.url,
        sessionId: command.sessionId,
        estimatedSize,
        profileId: command.profileId,
        output,
      });

      return {
        fileId: file.id,
        jobId: null,
        estimatedSize,
        status: FileStatus.QUEUED,
      };
    }

    let reserved = false;
    let fileId: string | undefined;
    await this.reservationService.reserve(command.sessionId, estimatedSize);
    reserved = true;

    try {
      const file = await this.fileStore.createProcessingDownload({
        url: command.url,
        sessionId: command.sessionId,
        estimatedSize,
        profileId: command.profileId,
        output,
      });
      fileId = file.id;

      const jobId = await this.queueProducer.enqueueDownloadJob({
        fileId: file.id,
        url: command.url,
        sessionId: command.sessionId,
        reservedBytes: estimatedSize,
        profileId: command.profileId,
        output,
      });

      await this.attachQueueJob(file.id, jobId);

      return {
        fileId: file.id,
        jobId,
        estimatedSize,
        status: FileStatus.PROCESSING,
      };
    } catch (error) {
      if (reserved) {
        await this.reservationService.release(command.sessionId, estimatedSize);
      }

      if (fileId) {
        await this.fileStore.markFailed(fileId, this.formatError(error));
      }

      throw error;
    }
  }

  private async resolveDownloadSelection(
    command: SubmitDownloadCommand,
  ): Promise<{ estimatedSize: number; output: DownloadOutput }> {
    if (!command.profileId) {
      const estimatedSize = await this.sizeEstimator.estimate(command.url);
      return { estimatedSize, output: DEFAULT_VIDEO_OUTPUT };
    }

    const profile = await this.profileCatalogue.getProfile(
      command.url,
      command.profileId,
    );
    if (!profile) {
      throw new BadRequestException('Selected profile is not available');
    }

    const estimatedSize = this.resolveSelectedProfileEstimate(profile);

    return {
      estimatedSize,
      output: coerceDownloadOutput({
        mediaKind: profile.mediaKind,
        extension: profile.ext,
        contentType: profile.contentType,
      }),
    };
  }

  private resolveSelectedProfileEstimate(profile: AvailableProfile): number {
    const estimatedSize = Number(profile.estimatedSize ?? 0);
    if (Number.isFinite(estimatedSize) && estimatedSize > 0) {
      return estimatedSize;
    }

    return Math.min(this.config.maxFileBytes, this.config.sessionMaxBytes);
  }

  private async attachQueueJob(fileId: string, jobId: string): Promise<void> {
    try {
      await this.fileStore.attachQueueJob(fileId, jobId);
    } catch (error) {
      this.logger.error(
        `Failed to attach queue job ${jobId} to file ${fileId}: ${this.formatError(
          error,
        )}`,
      );
    }
  }

  private throwAdmissionRejection(
    decision: Extract<DownloadAdmissionDecision, { kind: 'reject' }>,
  ): never {
    if (decision.reason === 'session_quota') {
      throw new ForbiddenException(decision.message);
    }

    throw new BadRequestException(decision.message);
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return `${error.name}: ${error.message}`;
    }

    return String(error);
  }
}
