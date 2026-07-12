import { Queue } from "bullmq";
import Redis from "ioredis";
import type { HealthResponse } from "@/types";
import { getPostgresPool } from "@/lib/server/postgres";

type ServiceCheck = HealthResponse["checks"]["postgres"];

type GlobalWithHealthClients = typeof globalThis & {
  __vdRedisClient?: Redis;
  __vdQueueClient?: Queue;
};

const globalHealth = globalThis as GlobalWithHealthClients;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getRedisClient(): Redis {
  if (!globalHealth.__vdRedisClient) {
    globalHealth.__vdRedisClient = new Redis(requiredEnv("REDIS_URL"), {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });
  }

  return globalHealth.__vdRedisClient;
}

function getQueueClient(): Queue {
  if (!globalHealth.__vdQueueClient) {
    globalHealth.__vdQueueClient = new Queue(
      process.env.QUEUE_NAME?.trim() || "video-queue",
      {
        connection: getRedisClient(),
      },
    );
  }

  return globalHealth.__vdQueueClient;
}

function toErrorDetails(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

async function checkPostgres(): Promise<ServiceCheck> {
  try {
    await getPostgresPool().query("SELECT 1");
    return { status: "up" };
  } catch (error) {
    return { status: "down", details: toErrorDetails(error) };
  }
}

async function checkRedis(): Promise<ServiceCheck> {
  try {
    const pong = await getRedisClient().ping();
    if (pong !== "PONG") {
      return {
        status: "down",
        details: "Unexpected redis ping response",
      };
    }

    return { status: "up" };
  } catch (error) {
    return { status: "down", details: toErrorDetails(error) };
  }
}

async function checkQueue(): Promise<ServiceCheck> {
  try {
    await getQueueClient().getJobCounts("waiting", "active", "failed");
    return { status: "up" };
  } catch (error) {
    return { status: "down", details: toErrorDetails(error) };
  }
}

export async function getSystemHealthStatus(): Promise<HealthResponse> {
  const [postgres, redis, queue] = await Promise.all([
    checkPostgres(),
    checkRedis(),
    checkQueue(),
  ]);

  const status: HealthResponse["status"] =
    postgres.status === "up" && redis.status === "up" && queue.status === "up"
      ? "ok"
      : "degraded";

  return {
    status,
    timestamp: new Date().toISOString(),
    checks: {
      postgres,
      redis,
      queue,
    },
  };
}
