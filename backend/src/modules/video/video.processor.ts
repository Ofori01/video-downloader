import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
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

  constructor(
    private readonly storageService: StorageService,
    private readonly videoService: VideoService,
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
    const stream = this.ytDlpService.getDownloadStream(url);

    let bytes = 0;
    stream.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
    });

    try {
      await this.storageService.uploadStream(key, stream);
      await this.videoService.markReady(fileId, key, bytes);
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
      this.logger.error(
        [
          `jobId=${String(job.id)}`,
          `sessionId=${sessionId}`,
          `fileId=${fileId}`,
          `event=processing_failed`,
          `error=${String(error)}`,
        ].join(' '),
      );
      await this.videoService.markFailed(fileId, String(error));
      await this.videoService.releaseReservation(sessionId, reservedBytes);
      throw error;
    }
  }
}
