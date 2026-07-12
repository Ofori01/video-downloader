import { DownloadCleanupCoordinator } from './download-cleanup-coordinator.service';

describe('DownloadCleanupCoordinator', () => {
  const fileStore = {
    findExpiredReadyFiles: jest.fn(),
    markDeleted: jest.fn(),
  };

  const promotionService = {
    promoteQueuedFiles: jest.fn(),
  };

  const reservationService = {
    release: jest.fn(),
    reconcileStorageUsageFromDb: jest.fn(),
  };

  const storageService = {
    deleteObject: jest.fn(),
  };

  const createService = () =>
    new DownloadCleanupCoordinator(
      fileStore as never,
      promotionService as never,
      reservationService as never,
      storageService as never,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    promotionService.promoteQueuedFiles.mockResolvedValue(2);
    reservationService.release.mockResolvedValue(undefined);
    reservationService.reconcileStorageUsageFromDb.mockResolvedValue(0);
    storageService.deleteObject.mockResolvedValue(undefined);
    fileStore.markDeleted.mockResolvedValue(undefined);
  });

  it('deletes expired files, releases reservations, reconciles storage, and promotes queued work', async () => {
    const service = createService();
    fileStore.findExpiredReadyFiles.mockResolvedValue([
      {
        id: 'file-1',
        key: 'videos/file-1.mp4',
        size: '1000',
        sessionId: 'session-1',
      },
    ]);

    await expect(service.cleanupExpiredFiles()).resolves.toEqual({
      deleted: 1,
      promoted: 2,
    });

    expect(storageService.deleteObject).toHaveBeenCalledWith(
      'videos/file-1.mp4',
    );
    expect(fileStore.markDeleted).toHaveBeenCalledWith('file-1');
    expect(reservationService.release).toHaveBeenCalledWith('session-1', 1000);
    expect(reservationService.reconcileStorageUsageFromDb).toHaveBeenCalled();
    expect(promotionService.promoteQueuedFiles).toHaveBeenCalled();
  });
});
