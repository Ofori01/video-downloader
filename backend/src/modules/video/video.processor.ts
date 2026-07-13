import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DOWNLOAD_JOB_NAME, METADATA_JOB_NAME } from '../queue/queue.constants';
import { VIDEO_QUEUE_NAME } from '../queue/queue-name';
import {
  DownloadVideoJobData,
  ExtractMetadataJobData,
  ExtractMetadataJobResult,
  VideoQueueJobData,
} from '../queue/queue.types';
import { StorageService } from '../storage/storage.service';
import { buildDownloadObjectKey, coerceDownloadOutput } from './download-output';
import { DownloadWorkerLifecycleService } from './download-worker-lifecycle.service';
import { YtDlpMetadataClient } from './ytdlp-metadata-client.service';
import { YtDlpStreamClient } from './ytdlp-stream-client.service';

@Processor(VIDEO_QUEUE_NAME, {
  concurrency: Number(process.env.WORKER_CONCURRENCY ?? 3),
})
@Injectable()
export class VideoProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoProcessor.name);

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return `${error.name}: ${error.message}`;
    }

    return String(error);
  }

  constructor(
    private readonly storageService: StorageService,
    @Inject(DownloadWorkerLifecycleService)
    private readonly downloadLifecycle: Pick<
      DownloadWorkerLifecycleService,
      | 'markReady'
      | 'reconcileReservationForCompletedFile'
      | 'markFailed'
      | 'releaseReservation'
    >,
    private readonly metadataClient: YtDlpMetadataClient,
    private readonly ytDlpStreamClient: YtDlpStreamClient,
  ) {
    super();
  }

  async process(
    job: Job<VideoQueueJobData>,
  ): Promise<void | ExtractMetadataJobResult> {
    if (job.name === METADATA_JOB_NAME) {
      return this.extractMetadata(job as Job<ExtractMetadataJobData>);
    }

    if (job.name !== DOWNLOAD_JOB_NAME) {
      return;
    }

    const downloadJob = job as Job<DownloadVideoJobData>;
    const { fileId, url, sessionId, reservedBytes } = downloadJob.data;
    this.logger.log(
      [
        `jobId=${String(job.id)}`,
        `sessionId=${sessionId}`,
        `fileId=${fileId}`,
        `event=processing_started`,
      ].join(' '),
    );

    const output = coerceDownloadOutput(downloadJob.data.output);
    const key = buildDownloadObjectKey(fileId, output);
    const useFallbackProfile = downloadJob.attemptsMade > 0;
    const { stream, diagnostics } = this.ytDlpStreamClient.getDownloadStream(
      url,
      {
        fallbackProfile: useFallbackProfile && !downloadJob.data.profileId,
        formatId: downloadJob.data.profileId,
      },
    );
    let streamFailure: unknown;
    let phase: 'upload' | 'mark_ready' | 'reconcile_reservation' = 'upload';

    this.logger.log(
      [
        `jobId=${String(job.id)}`,
        `sessionId=${sessionId}`,
        `fileId=${fileId}`,
        `event=stream_profile_selected`,
        `profile=${diagnostics.profile}`,
      ].join(' '),
    );

    let bytes = 0;
    stream.on('error', (error: unknown) => {
      streamFailure = error;
      this.logger.error(
        [
          `jobId=${String(job.id)}`,
          `sessionId=${sessionId}`,
          `fileId=${fileId}`,
          'event=source_stream_failed',
          `profile=${diagnostics.profile}`,
          `error=${this.formatError(error)}`,
        ].join(' '),
      );
    });
    stream.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
    });

    try {
      phase = 'upload';
      await this.storageService.uploadStream(key, stream, output.contentType);

      phase = 'mark_ready';
      await this.downloadLifecycle.markReady(fileId, key, bytes, output);

      phase = 'reconcile_reservation';
      await this.downloadLifecycle.reconcileReservationForCompletedFile(
        sessionId,
        reservedBytes,
        bytes,
      );
      this.logger.log(
        [
          `jobId=${String(job.id)}`,
          `sessionId=${sessionId}`,
          `fileId=${fileId}`,
          `event=processing_completed`,
          `bytes=${bytes}`,
        ].join(' '),
      );
    } catch (error) {
      const maxAttempts = Number(downloadJob.opts.attempts ?? 1);
      const isFinalAttempt = downloadJob.attemptsMade + 1 >= maxAttempts;

      this.logger.error(
        [
          `jobId=${String(job.id)}`,
          `sessionId=${sessionId}`,
          `fileId=${fileId}`,
          `event=processing_failed`,
          `source=${streamFailure ? 'ytdlp_stream' : 'upload_or_unknown'}`,
          `phase=${phase}`,
          `attempt=${downloadJob.attemptsMade + 1}`,
          `maxAttempts=${maxAttempts}`,
          `profile=${diagnostics.profile}`,
          `progress=${diagnostics.lastProgress ?? 'none'}`,
          `stderr=${diagnostics.stderrTail.join(' || ') || 'none'}`,
          `streamError=${streamFailure ? this.formatError(streamFailure) : 'none'}`,
          `error=${this.formatError(error)}`,
        ].join(' '),
      );

      if (isFinalAttempt) {
        await this.downloadLifecycle.markFailed(fileId, String(error));
        await this.downloadLifecycle.releaseReservation(
          sessionId,
          reservedBytes,
        );
      }

      throw error;
    }
  }

  private async extractMetadata(
    job: Job<ExtractMetadataJobData>,
  ): Promise<ExtractMetadataJobResult> {
    this.logger.log(`jobId=${String(job.id)} event=metadata_started`);
    const metadata = await this.metadataClient.getMetadata(job.data.url);
    this.logger.log(`jobId=${String(job.id)} event=metadata_completed`);
    return { metadata };
  }
}
