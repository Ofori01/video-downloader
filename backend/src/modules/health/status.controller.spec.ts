import { StatusController } from './status.controller';

describe('StatusController', () => {
  const healthService = {
    getApiProcessStatus: jest.fn(),
  };

  const createController = () => new StatusController(healthService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns API process status from the health service', () => {
    const controller = createController();
    const status = {
      status: 'ok',
      timestamp: '2026-07-14T09:30:00.000Z',
      uptimeSeconds: 120,
    };
    healthService.getApiProcessStatus.mockReturnValue(status);

    expect(controller.getStatus()).toEqual(status);
  });
});
