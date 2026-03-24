import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { AppConfigService } from '../../config/app-config.service';
import { SessionService } from './session.service';

@Injectable()
export class SessionMiddleware implements NestMiddleware {
  constructor(
    private readonly config: AppConfigService,
    private readonly sessionService: SessionService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    let sessionId = req.cookies?.[this.config.sessionCookieName] as
      | string
      | undefined;

    if (!sessionId) {
      sessionId = randomUUID();
      res.cookie(this.config.sessionCookieName, sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: this.config.sessionCookieSecure,
        maxAge: this.config.sessionCookieMaxAgeSeconds * 1000,
      });
    }

    req.sessionContext = { id: sessionId };
    await this.sessionService.touchSession(sessionId);

    next();
  }
}
