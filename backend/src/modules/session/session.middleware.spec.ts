import type { NextFunction, Request, Response } from 'express';
import { SessionMiddleware } from './session.middleware';

describe('SessionMiddleware', () => {
  const sessionService = {
    touchSession: jest.fn(),
  };

  const config = {
    sessionCookieName: 'sessionId',
    sessionCookieSecure: false,
    sessionCookieMaxAgeSeconds: 86400,
  };

  const createMiddleware = () =>
    new SessionMiddleware(config as never, sessionService as never);

  beforeEach(() => {
    jest.clearAllMocks();
    config.sessionCookieSecure = false;
  });

  it('creates and sets a session cookie when missing', async () => {
    const middleware = createMiddleware();
    const req = {
      cookies: {},
    } as unknown as Request;
    const cookie = jest.fn();
    const res = {
      cookie,
    } as unknown as Response;
    const next = jest.fn() as NextFunction;

    await middleware.use(req, res, next);

    expect(req.sessionContext?.id).toBeDefined();
    expect(cookie).toHaveBeenCalledTimes(1);
    expect(cookie).toHaveBeenCalledWith(
      'sessionId',
      req.sessionContext?.id,
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        maxAge: 86_400_000,
      }),
    );
    expect(sessionService.touchSession).toHaveBeenCalledWith(
      req.sessionContext?.id,
    );
    expect(next).toHaveBeenCalled();
  });

  it('uses sameSite none for secure cross-site session cookies', async () => {
    const middleware = createMiddleware();
    config.sessionCookieSecure = true;
    const req = {
      cookies: {},
    } as unknown as Request;
    const cookie = jest.fn();
    const res = {
      cookie,
    } as unknown as Response;
    const next = jest.fn() as NextFunction;

    await middleware.use(req, res, next);

    expect(cookie).toHaveBeenCalledWith(
      'sessionId',
      req.sessionContext?.id,
      expect.objectContaining({
        sameSite: 'none',
        secure: true,
      }),
    );
  });

  it('uses existing session cookie and does not set a new one', async () => {
    const middleware = createMiddleware();
    const req = {
      cookies: { sessionId: 'existing-session' },
    } as unknown as Request;
    const cookie = jest.fn();
    const res = {
      cookie,
    } as unknown as Response;
    const next = jest.fn() as NextFunction;

    await middleware.use(req, res, next);

    expect(req.sessionContext?.id).toBe('existing-session');
    expect(cookie).not.toHaveBeenCalled();
    expect(sessionService.touchSession).toHaveBeenCalledWith(
      'existing-session',
    );
    expect(next).toHaveBeenCalled();
  });
});
