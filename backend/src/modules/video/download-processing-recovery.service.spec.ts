import { DownloadProcessingRecoveryService } from './download-processing-recovery.service';

describe('DownloadProcessingRecoveryService', () => {
  const config = {
    processingStaleAfterSeconds: 3600,
  };

  const fileStore = {
    findStaleProcessingDownloads: jest.fn(),
    failProcessingDownload: jest.fn(),
  };

  const reservationService = {
    release: jest.fn(),
  };

  const createService = () =>
    new DownloadProcessingRecoveryService(
      config as never,
      fileStore as never,
      reservationService as never,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    fileStore.failProcessingDownload.mockResolvedValue(true);
    reservationService.release.mockResolvedValue(undefined);
  });

  it('marks stale processing files failed and releases their reservations', async () => {
    const service = createService();
    const now = new Date('2026-07-12T12:00:00.000Z');
    fileStore.findStaleProcessingDownloads.mockResolvedValue([
      {
        id: 'file-1',
        sessionId: 'session-1',
        size: '1000',
      },
      {
        id: 'file-2',
        sessionId: 'session-2',
        size: null,
      },
    ]);

    await expect(
      service.recoverStaleProcessingDownloads(now, 50),
    ).resolves.toEqual({
      staleCutoff: new Date('2026-07-12T11:00:00.000Z'),
      inspected: 2,
      failed: 2,
      releasedBytes: 1000,
      sessionIds: ['session-1', 'session-2'],
    });

    expect(fileStore.findStaleProcessingDownloads).toHaveBeenCalledWith(
      new Date('2026-07-12T11:00:00.000Z'),
      50,
    );
    expect(fileStore.failProcessingDownload).toHaveBeenCalledWith(
      'file-1',
      'Processing exceeded 3600s without completion',
    );
    expect(reservationService.release).toHaveBeenCalledWith('session-1', 1000);
    expect(reservationService.release).toHaveBeenCalledTimes(1);
  });

  it('does not release when the processing file was already claimed by another transition', async () => {
    const service = createService();
    fileStore.findStaleProcessingDownloads.mockResolvedValue([
      {
        id: 'file-1',
        sessionId: 'session-1',
        size: '1000',
      },
    ]);
    fileStore.failProcessingDownload.mockResolvedValue(false);

    await expect(service.recoverStaleProcessingDownloads()).resolves.toEqual(
      expect.objectContaining({
        inspected: 1,
        failed: 0,
        releasedBytes: 0,
        sessionIds: [],
      }),
    );

    expect(reservationService.release).not.toHaveBeenCalled();
  });
});
