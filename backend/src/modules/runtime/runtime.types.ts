export type RuntimeCheckStatus = 'up' | 'down';

export interface RuntimeCheck {
  status: RuntimeCheckStatus;
  details?: string;
}

export interface RuntimeHealthStatus {
  status: 'ok' | 'degraded';
  timestamp: string;
  checks: {
    postgres: RuntimeCheck;
    redis: RuntimeCheck;
    queue: RuntimeCheck;
    worker: RuntimeCheck;
    ytDlp: RuntimeCheck;
    ffmpeg: RuntimeCheck;
  };
}

export interface BinaryReadinessResult {
  ytDlp: RuntimeCheck;
  ffmpeg: RuntimeCheck;
}
