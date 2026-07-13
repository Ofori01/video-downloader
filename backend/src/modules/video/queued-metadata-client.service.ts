import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue, QueueEvents } from 'bullmq';
import { AppConfigService } from '../../config/app-config.service';
import { METADATA_JOB_NAME } from '../queue/queue.constants';
import { VIDEO_QUEUE_NAME } from '../queue/queue-name';
import {
  ExtractMetadataJobResult,
  VideoQueueJobData,
} from '../queue/queue.types';
import type { VideoMetadataClient } from './video-metadata-client';
import type { YtDlpMetadata } from './ytdlp.types';

const METADATA_JOB_TIMEOUT_MS = 45_000;

@Injectable()
export class QueuedMetadataClient
  implements VideoMetadataClient, OnModuleDestroy
{
  private readonly logger = new Logger(QueuedMetadataClient.name);
  private readonly queueEvents: QueueEvents;

  constructor(
    @InjectQueue(VIDEO_QUEUE_NAME)
    private readonly queue: Queue<VideoQueueJobData>,
    config: AppConfigService,
  ) {
    this.queueEvents = new QueueEvents(VIDEO_QUEUE_NAME, {
      connection: {
        url: config.redisUrl,
      },
    });
  }

  async getMetadata(url: string): Promise<YtDlpMetadata | null> {
    await this.queueEvents.waitUntilReady();

    const job = await this.queue.add(
      METADATA_JOB_NAME,
      { url },
      {
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    );

    try {
      const result = (await job.waitUntilFinished(
        this.queueEvents,
        METADATA_JOB_TIMEOUT_MS,
      )) as ExtractMetadataJobResult;
      return result.metadata;
    } catch (error) {
      this.logger.warn(
        `Metadata job failed for jobId=${String(job.id)}: ${this.formatError(
          error,
        )}`,
      );
      return null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.queueEvents.close();
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return `${error.name}: ${error.message}`;
    }

    return String(error);
  }
}
