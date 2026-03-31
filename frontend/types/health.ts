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
  };
}
