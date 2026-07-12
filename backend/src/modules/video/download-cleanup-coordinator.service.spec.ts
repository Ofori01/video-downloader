import { DownloadCleanupCoordinator } from './download-cleanup-coordinator.service';

describe('DownloadCleanupCoordinator', () => {
  const fileStore = {
    findExpiredReadyFiles: jest.fn(),
    markDeleted: jest.fn(),
  };

  const reservationService = {
    release: jest.fn(),
  };

  const storageService = {
    deleteObject: jest.fn(),
  };

  const createService = () =>
    new DownloadCleanupCoordinator(
      fileStore as never,
      reservationService as never,
      storageService as never,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    reservationService.release.mockResolvedValue(undefined);
    storageService.deleteObject.mockResolvedValue(undefined);
    fileStore.markDeleted.mockResolvedValue(undefined);
  });

  it('deletes expired files and releases reservations', async () => {
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
      releasedBytes: 1000,
      sessionIds: ['session-1'],
    });

    expect(storageService.deleteObject).toHaveBeenCalledWith(
      'videos/file-1.mp4',
    );
    expect(fileStore.markDeleted).toHaveBeenCalledWith('file-1');
    expect(reservationService.release).toHaveBeenCalledWith('session-1', 1000);
  });
});
