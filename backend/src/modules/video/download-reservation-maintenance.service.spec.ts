import { DownloadReservationMaintenanceService } from './download-reservation-maintenance.service';

describe('DownloadReservationMaintenanceService', () => {
  const cleanupCoordinator = {
    cleanupExpiredFiles: jest.fn(),
  };

  const processingRecovery = {
    recoverStaleProcessingDownloads: jest.fn(),
  };

  const promotionService = {
    promoteQueuedFiles: jest.fn(),
  };

  const reservationService = {
    reconcileActiveReservationsFromDb: jest.fn(),
  };

  const createService = () =>
    new DownloadReservationMaintenanceService(
      cleanupCoordinator as never,
      processingRecovery as never,
      promotionService as never,
      reservationService as never,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    processingRecovery.recoverStaleProcessingDownloads.mockResolvedValue({
      staleCutoff: new Date('2026-07-12T11:00:00.000Z'),
      inspected: 1,
      failed: 1,
      releasedBytes: 1000,
      sessionIds: ['stale-session'],
    });
    cleanupCoordinator.cleanupExpiredFiles.mockResolvedValue({
      deleted: 1,
      releasedBytes: 500,
      sessionIds: ['expired-session'],
    });
    reservationService.reconcileActiveReservationsFromDb.mockResolvedValue({
      storageBytes: 2500,
      sessions: [],
    });
    promotionService.promoteQueuedFiles.mockResolvedValue(2);
  });

  it('reconciles reservations on worker startup after stale processing recovery', async () => {
    const service = createService();

    await service.onApplicationBootstrap();

    expect(
      processingRecovery.recoverStaleProcessingDownloads,
    ).toHaveBeenCalled();
    expect(
      reservationService.reconcileActiveReservationsFromDb,
    ).toHaveBeenCalledWith(['stale-session']);
    expect(promotionService.promoteQueuedFiles).not.toHaveBeenCalled();
  });

  it('runs scheduled maintenance in recovery, cleanup, reconciliation, promotion order', async () => {
    const service = createService();

    const summary = await service.runScheduledMaintenance();

    expect(summary.recovery.failed).toBe(1);
    expect(summary.expiredCleanup.deleted).toBe(1);
    expect(summary.reconciliation).toEqual({
      storageBytes: 2500,
      sessions: [],
    });
    expect(summary.promoted).toBe(2);

    expect(
      reservationService.reconcileActiveReservationsFromDb,
    ).toHaveBeenCalledWith(['stale-session', 'expired-session']);
    expect(promotionService.promoteQueuedFiles).toHaveBeenCalledTimes(1);
  });
});
