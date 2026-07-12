import { DownloadWorkerLifecycleService } from './download-worker-lifecycle.service';

describe('DownloadWorkerLifecycleService', () => {
  const config = {
    fileTtlSeconds: 3600,
  };

  const fileStore = {
    markReady: jest.fn(),
    markFailed: jest.fn(),
  };

  const reservationService = {
    release: jest.fn(),
    reconcileCompleted: jest.fn(),
  };

  const createService = () =>
    new DownloadWorkerLifecycleService(
      config as never,
      fileStore as never,
      reservationService as never,
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sets expiry when marking a file ready', async () => {
    const service = createService();

    await service.markReady('file-1', 'videos/file-1.mp4', 2048);

    expect(fileStore.markReady).toHaveBeenCalledWith(
      'file-1',
      'videos/file-1.mp4',
      2048,
      expect.any(Date),
    );
  });

  it('marks a file failed with the provided reason', async () => {
    const service = createService();

    await service.markFailed('file-1', 'download failed');

    expect(fileStore.markFailed).toHaveBeenCalledWith(
      'file-1',
      'download failed',
    );
  });

  it('delegates completed reservation reconciliation', async () => {
    const service = createService();

    await service.reconcileReservationForCompletedFile('session-1', 1000, 750);

    expect(reservationService.reconcileCompleted).toHaveBeenCalledWith(
      'session-1',
      1000,
      750,
    );
  });
});
