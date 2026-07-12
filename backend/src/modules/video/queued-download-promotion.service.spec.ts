import { QueuedDownloadPromotionService } from './queued-download-promotion.service';

describe('QueuedDownloadPromotionService', () => {
  const fileStore = {
    findQueuedDownloads: jest.fn(),
    markFailed: jest.fn(),
    claimQueuedDownload: jest.fn(),
    attachQueueJob: jest.fn(),
  };

  const queueProducer = {
    enqueueDownloadJob: jest.fn(),
  };

  const reservationService = {
    evaluateAdmission: jest.fn(),
    reserve: jest.fn(),
    release: jest.fn(),
  };

  const createService = () =>
    new QueuedDownloadPromotionService(
      fileStore as never,
      queueProducer as never,
      reservationService as never,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    reservationService.evaluateAdmission.mockResolvedValue({ kind: 'process' });
    reservationService.reserve.mockResolvedValue(undefined);
    reservationService.release.mockResolvedValue(undefined);
    fileStore.claimQueuedDownload.mockResolvedValue(true);
    fileStore.attachQueueJob.mockResolvedValue(undefined);
    queueProducer.enqueueDownloadJob.mockResolvedValue('job-1');
  });

  it('promotes queued files with the stored selected profile', async () => {
    const service = createService();
    fileStore.findQueuedDownloads.mockResolvedValue([
      {
        id: 'file-queued-1',
        sourceUrl: 'https://example.com/video',
        size: '1000',
        sessionId: 'session-1',
        profileId: '18',
      },
    ]);

    const promoted = await service.promoteQueuedFiles();

    expect(promoted).toBe(1);
    expect(reservationService.reserve).toHaveBeenCalledWith('session-1', 1000);
    expect(fileStore.claimQueuedDownload).toHaveBeenCalledWith('file-queued-1');
    expect(queueProducer.enqueueDownloadJob).toHaveBeenCalledWith({
      fileId: 'file-queued-1',
      url: 'https://example.com/video',
      sessionId: 'session-1',
      reservedBytes: 1000,
      profileId: '18',
    });
    expect(fileStore.attachQueueJob).toHaveBeenCalledWith(
      'file-queued-1',
      'job-1',
    );
  });

  it('stops promotion when global storage capacity is still full', async () => {
    const service = createService();
    fileStore.findQueuedDownloads.mockResolvedValue([
      {
        id: 'file-queued-1',
        sourceUrl: 'https://example.com/video',
        size: '1000',
        sessionId: 'session-1',
        profileId: null,
      },
    ]);
    reservationService.evaluateAdmission.mockResolvedValue({
      kind: 'queue',
      reason: 'storage_capacity',
    });

    await expect(service.promoteQueuedFiles()).resolves.toBe(0);

    expect(reservationService.reserve).not.toHaveBeenCalled();
    expect(queueProducer.enqueueDownloadJob).not.toHaveBeenCalled();
  });

  it('releases reservation and marks failed when queue insertion fails', async () => {
    const service = createService();
    fileStore.findQueuedDownloads.mockResolvedValue([
      {
        id: 'file-queued-1',
        sourceUrl: 'https://example.com/video',
        size: '1000',
        sessionId: 'session-1',
        profileId: null,
      },
    ]);
    queueProducer.enqueueDownloadJob.mockRejectedValue(
      new Error('redis unavailable'),
    );

    await expect(service.promoteQueuedFiles()).resolves.toBe(0);

    expect(reservationService.release).toHaveBeenCalledWith('session-1', 1000);
    expect(fileStore.markFailed).toHaveBeenCalledWith(
      'file-queued-1',
      'Error: redis unavailable',
    );
  });
});
