import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Date.now() - start;
          this.logger.log(
            [
              `requestId=${req.requestId ?? 'unknown'}`,
              `sessionId=${req.sessionContext?.id ?? 'none'}`,
              `method=${req.method}`,
              `path=${req.originalUrl}`,
              `status=${res.statusCode}`,
              `durationMs=${durationMs}`,
            ].join(' '),
          );
        },
        error: (error: unknown) => {
          const durationMs = Date.now() - start;
          this.logger.error(
            [
              `requestId=${req.requestId ?? 'unknown'}`,
              `sessionId=${req.sessionContext?.id ?? 'none'}`,
              `method=${req.method}`,
              `path=${req.originalUrl}`,
              `status=${res.statusCode}`,
              `durationMs=${durationMs}`,
              `error=${String(error)}`,
            ].join(' '),
          );
        },
      }),
    );
  }
}
