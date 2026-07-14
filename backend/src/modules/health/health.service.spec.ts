import { HealthService } from './health.service';

describe('HealthService', () => {
  const runtimeOperations = {
    getApiRuntimeStatus: jest.fn(),
  };

  const createService = () => new HealthService(runtimeOperations as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns cheap API process status without dependency checks', () => {
    const service = createService();

    const status = service.getApiProcessStatus();

    expect(status.status).toBe('ok');
    expect(status.timestamp).toEqual(expect.any(String));
    expect(status.uptimeSeconds).toEqual(expect.any(Number));
    expect(runtimeOperations.getApiRuntimeStatus).not.toHaveBeenCalled();
  });
});
