import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { VIDEO_QUEUE_NAME } from './queue-name';
import { VideoQueueJobData } from './queue.types';

export interface QueueRuntimeMetrics {
  waiting: number;
  active: number;
  failed: number;
}

@Injectable()
export class QueueDiagnosticsService {
  constructor(
    @InjectQueue(VIDEO_QUEUE_NAME)
    private readonly queue: Queue<VideoQueueJobData>,
  ) {}

  async getQueueMetrics(): Promise<QueueRuntimeMetrics> {
    const [waiting, active, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getFailedCount(),
    ]);

    return { waiting, active, failed };
  }

  async getWorkerCount(): Promise<number> {
    return this.queue.getWorkersCount();
  }
}
