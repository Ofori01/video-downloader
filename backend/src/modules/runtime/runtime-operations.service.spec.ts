import { RuntimeBinaryReadinessService } from './runtime-binary-readiness.service';
import { RuntimeOperationsService } from './runtime-operations.service';

describe('RuntimeOperationsService', () => {
  const dataSource = {
    query: jest.fn(),
  };
  const redisService = {
    raw: {
      ping: jest.fn(),
    },
  };
  const queueDiagnostics = {
    getQueueMetrics: jest.fn(),
    getWorkerCount: jest.fn(),
  };
  const binaryReadiness = {
    checkRequiredBinaries: jest.fn(),
  };

  const createService = () =>
    new RuntimeOperationsService(
      dataSource as never,
      redisService as never,
      queueDiagnostics as never,
      binaryReadiness as unknown as RuntimeBinaryReadinessService,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    dataSource.query.mockResolvedValue([{ result: 1 }]);
    redisService.raw.ping.mockResolvedValue('PONG');
    queueDiagnostics.getQueueMetrics.mockResolvedValue({
      waiting: 1,
      active: 2,
      failed: 3,
    });
    queueDiagnostics.getWorkerCount.mockResolvedValue(1);
    binaryReadiness.checkRequiredBinaries.mockResolvedValue({
      ytDlp: { status: 'up', details: '2026.01.01' },
      ffmpeg: { status: 'up', details: 'ffmpeg version 7.0' },
    });
  });

  it('reports ok when dependencies, worker, and media binaries are ready', async () => {
    const status = await createService().getApiRuntimeStatus();

    expect(status.status).toBe('ok');
    expect(status.checks.queue).toEqual({
      status: 'up',
      details: 'waiting=1 active=2 failed=3',
    });
    expect(status.checks.worker).toEqual({
      status: 'up',
      details: '1 worker connected',
    });
  });

  it('degrades when the queue is reachable but no worker is connected', async () => {
    queueDiagnostics.getWorkerCount.mockResolvedValue(0);

    const status = await createService().getApiRuntimeStatus();

    expect(status.status).toBe('degraded');
    expect(status.checks.queue.status).toBe('up');
    expect(status.checks.worker).toEqual({
      status: 'down',
      details: 'No BullMQ workers connected to the video queue',
    });
  });

  it('degrades when a required media binary is unavailable', async () => {
    binaryReadiness.checkRequiredBinaries.mockResolvedValue({
      ytDlp: { status: 'down', details: 'yt-dlp unavailable' },
      ffmpeg: { status: 'up' },
    });

    const status = await createService().getApiRuntimeStatus();

    expect(status.status).toBe('degraded');
    expect(status.checks.ytDlp).toEqual({
      status: 'down',
      details: 'yt-dlp unavailable',
    });
  });
});
