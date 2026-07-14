export type HealthState = "up" | "down";

export interface ServiceCheck {
  status: HealthState;
  details?: string;
}

export interface HealthResponse {
  status: "ok" | "degraded";
  timestamp: string;
  checks: {
    postgres: ServiceCheck;
    redis: ServiceCheck;
    queue: ServiceCheck;
    worker: ServiceCheck;
  };
}

export interface SystemStatusResponse {
  status: "ok";
  timestamp: string;
  uptimeSeconds: number;
}
