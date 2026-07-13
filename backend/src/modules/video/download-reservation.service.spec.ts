import { STORAGE_USED_KEY } from '../queue/queue.constants';
import { DownloadReservationService } from './download-reservation.service';

describe('DownloadReservationService', () => {
  const config = {
    maxFileBytes: 1_000_000_000,
    sessionMaxBytes: 500_000_000,
    maxStorageBytes: 10_000_000_000,
  };

  const fileStore = {
    getActiveSessionBytes: jest.fn(),
    getActiveStorageBytes: jest.fn(),
    getActiveReservationSessionIds: jest.fn(),
  };

  const redisService = {
    getNumber: jest.fn(),
    incrementBy: jest.fn(),
    decrementBy: jest.fn(),
    setNumber: jest.fn(),
  };

  const sessionService = {
    getSessionBytes: jest.fn(),
    reserveSessionBytes: jest.fn(),
    releaseSessionBytes: jest.fn(),
    setSessionBytes: jest.fn(),
  };

  const createService = () =>
    new DownloadReservationService(
      config as never,
      fileStore as never,
      redisService as never,
      sessionService as never,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    config.maxStorageBytes = 10_000_000_000;
    sessionService.getSessionBytes.mockResolvedValue(0);
    redisService.getNumber.mockResolvedValue(0);
    fileStore.getActiveReservationSessionIds.mockResolvedValue([]);
  });

  it('returns process when session and global capacity are available', async () => {
    const service = createService();

    await expect(service.evaluateAdmission('session-1', 1000)).resolves.toEqual(
      { kind: 'process' },
    );
  });

  it('returns queue when global storage capacity is exceeded', async () => {
    const service = createService();
    redisService.getNumber.mockResolvedValue(5000);
    config.maxStorageBytes = 4500;

    await expect(service.evaluateAdmission('session-1', 1000)).resolves.toEqual(
      { kind: 'queue', reason: 'storage_capacity' },
    );
  });

  it('falls back to DB usage when redis session bytes are stale high', async () => {
    const service = createService();
    sessionService.getSessionBytes.mockResolvedValue(600_000_000);
    fileStore.getActiveSessionBytes.mockResolvedValue(0);

    await expect(service.evaluateAdmission('session-1', 1000)).resolves.toEqual(
      { kind: 'process' },
    );

    expect(sessionService.setSessionBytes).toHaveBeenCalledWith('session-1', 0);
  });

  it('rejects when per-session storage quota is exceeded', async () => {
    const service = createService();
    sessionService.getSessionBytes.mockResolvedValue(499_999_500);
    fileStore.getActiveSessionBytes.mockResolvedValue(499_999_500);

    await expect(service.evaluateAdmission('session-1', 1000)).resolves.toEqual(
      {
        kind: 'reject',
        reason: 'session_quota',
        message: 'Session storage quota exceeded',
      },
    );
  });

  it('reserves bytes against session and global counters', async () => {
    const service = createService();

    await service.reserve('session-1', 1000);

    expect(sessionService.reserveSessionBytes).toHaveBeenCalledWith(
      'session-1',
      1000,
    );
    expect(redisService.incrementBy).toHaveBeenCalledWith(
      STORAGE_USED_KEY,
      1000,
    );
  });

  it('releases reserved bytes when actual output is smaller', async () => {
    const service = createService();

    await service.reconcileCompleted('session-1', 1000, 750);

    expect(sessionService.releaseSessionBytes).toHaveBeenCalledWith(
      'session-1',
      250,
    );
    expect(redisService.decrementBy).toHaveBeenCalledWith(
      STORAGE_USED_KEY,
      250,
    );
    expect(sessionService.reserveSessionBytes).not.toHaveBeenCalled();
    expect(redisService.incrementBy).not.toHaveBeenCalled();
  });

  it('reserves additional bytes when actual output is larger', async () => {
    const service = createService();

    await service.reconcileCompleted('session-1', 1000, 1250);

    expect(sessionService.reserveSessionBytes).toHaveBeenCalledWith(
      'session-1',
      250,
    );
    expect(redisService.incrementBy).toHaveBeenCalledWith(
      STORAGE_USED_KEY,
      250,
    );
    expect(sessionService.releaseSessionBytes).not.toHaveBeenCalled();
    expect(redisService.decrementBy).not.toHaveBeenCalled();
  });

  it('reconciles global storage usage from the database', async () => {
    const service = createService();
    fileStore.getActiveStorageBytes.mockResolvedValue(12345);

    await expect(service.reconcileStorageUsageFromDb()).resolves.toBe(12345);

    expect(redisService.setNumber).toHaveBeenCalledWith(
      STORAGE_USED_KEY,
      12345,
    );
  });

  it('reconciles a session reservation counter from the database', async () => {
    const service = createService();
    fileStore.getActiveSessionBytes.mockResolvedValue(2500);

    await expect(
      service.reconcileSessionUsageFromDb('session-1'),
    ).resolves.toEqual({
      sessionId: 'session-1',
      bytes: 2500,
    });

    expect(sessionService.setSessionBytes).toHaveBeenCalledWith(
      'session-1',
      2500,
    );
  });

  it('reconciles storage and active session reservations from the database', async () => {
    const service = createService();
    fileStore.getActiveStorageBytes.mockResolvedValue(7000);
    fileStore.getActiveReservationSessionIds.mockResolvedValue([
      'session-1',
      'session-2',
    ]);
    fileStore.getActiveSessionBytes
      .mockResolvedValueOnce(1000)
      .mockResolvedValueOnce(2000)
      .mockResolvedValueOnce(0);

    await expect(
      service.reconcileActiveReservationsFromDb(['session-2', 'stale-session']),
    ).resolves.toEqual({
      storageBytes: 7000,
      sessions: [
        { sessionId: 'session-1', bytes: 1000 },
        { sessionId: 'session-2', bytes: 2000 },
        { sessionId: 'stale-session', bytes: 0 },
      ],
    });

    expect(redisService.setNumber).toHaveBeenCalledWith(STORAGE_USED_KEY, 7000);
    expect(sessionService.setSessionBytes).toHaveBeenCalledWith(
      'session-1',
      1000,
    );
    expect(sessionService.setSessionBytes).toHaveBeenCalledWith(
      'session-2',
      2000,
    );
    expect(sessionService.setSessionBytes).toHaveBeenCalledWith(
      'stale-session',
      0,
    );
  });
});
