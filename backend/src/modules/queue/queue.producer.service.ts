import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DOWNLOAD_JOB_NAME } from './queue.constants';
import { VIDEO_QUEUE_NAME } from './queue-name';
import { DownloadVideoJobData } from './queue.types';

@Injectable()
export class QueueProducerService {
  constructor(
    @InjectQueue(VIDEO_QUEUE_NAME)
    private readonly queue: Queue<DownloadVideoJobData>,
  ) {}

  async enqueueDownloadJob(data: DownloadVideoJobData): Promise<string> {
    const job = await this.queue.add(DOWNLOAD_JOB_NAME, data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 3_000,
      },
      removeOnComplete: 200,
      removeOnFail: 500,
    });

    return job.id as string;
  }

  async getQueueMetrics(): Promise<{
    waiting: number;
    active: number;
    failed: number;
  }> {
    const [waiting, active, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getFailedCount(),
    ]);

    return { waiting, active, failed };
  }
}
