import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DOWNLOAD_JOB_NAME } from '../queue/queue.constants';
import { VIDEO_QUEUE_NAME } from '../queue/queue-name';
import { DownloadVideoJobData } from '../queue/queue.types';
import { StorageService } from '../storage/storage.service';
import { VideoService } from './video.service';
import { YtDlpService } from './ytdlp.service';

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
    @Inject(VideoService)
    private readonly videoService: Pick<
      VideoService,
      | 'markReady'
      | 'reconcileReservationForCompletedFile'
      | 'markFailed'
      | 'releaseReservation'
    >,
    private readonly ytDlpService: YtDlpService,
  ) {
    super();
  }

  async process(job: Job<DownloadVideoJobData>): Promise<void> {
    if (job.name !== DOWNLOAD_JOB_NAME) {
      return;
    }

    const { fileId, url, sessionId, reservedBytes } = job.data;
    this.logger.log(
      [
        `jobId=${String(job.id)}`,
        `sessionId=${sessionId}`,
        `fileId=${fileId}`,
        `event=processing_started`,
      ].join(' '),
    );

    const key = `videos/${fileId}.mp4`;
    const useFallbackProfile = job.attemptsMade > 0;
    const { stream, diagnostics } = this.ytDlpService.getDownloadStream(url, {
      fallbackProfile: useFallbackProfile && !job.data.profileId,
      formatId: job.data.profileId,
    });
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
      await this.storageService.uploadStream(key, stream);

      phase = 'mark_ready';
      await this.videoService.markReady(fileId, key, bytes);

      phase = 'reconcile_reservation';
      await this.videoService.reconcileReservationForCompletedFile(
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
      const maxAttempts = Number(job.opts.attempts ?? 1);
      const isFinalAttempt = job.attemptsMade + 1 >= maxAttempts;

      this.logger.error(
        [
          `jobId=${String(job.id)}`,
          `sessionId=${sessionId}`,
          `fileId=${fileId}`,
          `event=processing_failed`,
          `source=${streamFailure ? 'ytdlp_stream' : 'upload_or_unknown'}`,
          `phase=${phase}`,
          `attempt=${job.attemptsMade + 1}`,
          `maxAttempts=${maxAttempts}`,
          `profile=${diagnostics.profile}`,
          `progress=${diagnostics.lastProgress ?? 'none'}`,
          `stderr=${diagnostics.stderrTail.join(' || ') || 'none'}`,
          `streamError=${streamFailure ? this.formatError(streamFailure) : 'none'}`,
          `error=${this.formatError(error)}`,
        ].join(' '),
      );

      if (isFinalAttempt) {
        await this.videoService.markFailed(fileId, String(error));
        await this.videoService.releaseReservation(sessionId, reservedBytes);
      }

      throw error;
    }
  }
}
