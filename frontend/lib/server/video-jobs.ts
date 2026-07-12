import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { Queue } from "bullmq";
import Redis from "ioredis";
import { cookies } from "next/headers";
import type { VideoJobCreateResponse } from "@/types";
import { getPostgresPool } from "@/lib/server/postgres";

type GlobalWithVideoClients = typeof globalThis & {
  __vdRedisClient?: Redis;
  __vdQueueClient?: Queue;
};

type HttpFailure = {
  statusCode: number;
  message: string;
  error: string;
};

export type YtDlpMetadata = {
  filesize?: number;
  filesize_approx?: number;
  requested_downloads?: Array<{
    filesize?: number;
    filesize_approx?: number;
  }>;
  formats?: Array<{
    format_id?: string;
    filesize?: number;
    filesize_approx?: number;
    tbr?: number;
    abr?: number;
    vbr?: number;
    duration?: number;
    height?: number;
  }>;
  format_id?: string;
  duration?: number;
  height?: number;
};

type YtDlpFormat = {
  format_id?: string;
  filesize?: number;
  filesize_approx?: number;
  tbr?: number;
  abr?: number;
  vbr?: number;
  duration?: number;
  height?: number;
};

const globalVideo = globalThis as GlobalWithVideoClients;

const STORAGE_USED_KEY = "storage_used";
const DOWNLOAD_JOB_NAME = "download-video";

export function getStringEnv(name: string, defaultValue?: string): string {
  const value = process.env[name]?.trim();
  if (value) {
    return value;
  }

  if (defaultValue !== undefined) {
    return defaultValue;
  }

  throw new Error(`Missing required environment variable: ${name}`);
}

export function getBooleanEnv(name: string, defaultValue: boolean): boolean {
  const value = process.env[name]?.trim();
  if (!value) {
    return defaultValue;
  }

  return value === "true" || value === "1";
}

export function getNumberEnv(name: string, defaultValue: number): number {
  const value = process.env[name]?.trim();
  if (!value) {
    return defaultValue;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export function getRedisClient(): Redis {
  if (!globalVideo.__vdRedisClient) {
    globalVideo.__vdRedisClient = new Redis(getStringEnv("REDIS_URL"), {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });
  }

  return globalVideo.__vdRedisClient;
}

function getQueueClient(): Queue {
  if (!globalVideo.__vdQueueClient) {
    globalVideo.__vdQueueClient = new Queue(
      getStringEnv("QUEUE_NAME", "video-queue"),
      {
        connection: getRedisClient(),
      },
    );
  }

  return globalVideo.__vdQueueClient;
}

export function createHttpFailure(
  statusCode: number,
  message: string,
  error: string,
): HttpFailure {
  return { statusCode, message, error };
}

export function ensureValidUrl(input: string): string {
  let parsed: URL;

  try {
    parsed = new URL(input);
  } catch {
    throw createHttpFailure(400, "url must be a valid URL", "Bad Request");
  }

  if (!parsed.protocol || !/^https?:$/.test(parsed.protocol)) {
    throw createHttpFailure(400, "url must be a valid URL", "Bad Request");
  }

  return parsed.toString();
}

function getSessionCookieName(): string {
  return getStringEnv("SESSION_COOKIE_NAME", "sessionId");
}

export async function ensureSessionId(): Promise<string> {
  const cookieStore = await cookies();
  const cookieName = getSessionCookieName();
  const existing = cookieStore.get(cookieName)?.value?.trim();

  if (existing) {
    return existing;
  }

  const nextSessionId = randomUUID();
  cookieStore.set(cookieName, nextSessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: getBooleanEnv("SESSION_COOKIE_SECURE", true),
    maxAge: getNumberEnv("SESSION_COOKIE_MAX_AGE_SECONDS", 86400),
    path: "/",
  });

  return nextSessionId;
}

export async function touchSession(sessionId: string): Promise<void> {
  const pool = getPostgresPool();
  await pool.query(
    `INSERT INTO sessions ("id") VALUES ($1)
     ON CONFLICT ("id") DO NOTHING`,
    [sessionId],
  );

  await pool.query(
    `UPDATE sessions
     SET "requestCount" = "requestCount" + 1,
         "lastSeenAt" = NOW()
     WHERE "id" = $1`,
    [sessionId],
  );
}

async function incrementSessionJobs(sessionId: string): Promise<number> {
  const redis = getRedisClient();
  const key = `session:${sessionId}:jobs`;
  const windowSeconds = getNumberEnv("SESSION_WINDOW_SECONDS", 600);

  const tx = redis.multi();
  tx.incr(key);
  tx.expire(key, windowSeconds, "NX");

  const result = await tx.exec();
  const value = result?.[0]?.[1];
  return typeof value === "number" ? value : Number(value ?? 0);
}

async function getRedisNumber(key: string): Promise<number> {
  const value = await getRedisClient().get(key);
  return value ? Number(value) : 0;
}

async function reserveSessionBytes(
  sessionId: string,
  bytes: number,
): Promise<void> {
  await getRedisClient().incrby(`session:${sessionId}:bytes_used`, bytes);
}

async function releaseSessionBytes(
  sessionId: string,
  bytes: number,
): Promise<void> {
  await getRedisClient().decrby(`session:${sessionId}:bytes_used`, bytes);
}

async function incrementStorageUsed(bytes: number): Promise<void> {
  await getRedisClient().incrby(STORAGE_USED_KEY, bytes);
}

async function decrementStorageUsed(bytes: number): Promise<void> {
  await getRedisClient().decrby(STORAGE_USED_KEY, bytes);
}

async function setSessionBytes(
  sessionId: string,
  bytes: number,
): Promise<void> {
  await getRedisClient().set(
    `session:${sessionId}:bytes_used`,
    String(Math.max(0, Math.trunc(bytes))),
  );
}

async function getSessionBytesFromDb(sessionId: string): Promise<number> {
  const result = await getPostgresPool().query<{ total: string }>(
    `SELECT COALESCE(SUM("size"::bigint), 0) AS total
     FROM files
     WHERE "sessionId" = $1
       AND "status" IN ('processing', 'ready')
       AND "size" IS NOT NULL`,
    [sessionId],
  );

  return Number(result.rows[0]?.total ?? 0);
}

function runYtDlp(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const binary = process.env.YTDLP_BINARY_PATH?.trim() || "yt-dlp";
    const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"] });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    child.on("error", (error) => {
      reject(
        createHttpFailure(
          503,
          `Unable to execute yt-dlp: ${error.message}`,
          "Service Unavailable",
        ),
      );
    });

    child.on("close", (code) => {
      if (code !== 0) {
        const stderr = Buffer.concat(stderrChunks).toString().trim();
        reject(
          createHttpFailure(
            400,
            stderr || "Unable to inspect the requested source URL",
            "Bad Request",
          ),
        );
        return;
      }

      resolve(Buffer.concat(stdoutChunks).toString());
    });
  });
}

export async function getMetadata(url: string): Promise<YtDlpMetadata> {
  const raw = await runYtDlp([
    "--no-playlist",
    "--dump-single-json",
    "--skip-download",
    url,
  ]);

  try {
    return JSON.parse(raw) as YtDlpMetadata;
  } catch {
    throw createHttpFailure(
      400,
      "Unable to inspect the requested source URL",
      "Bad Request",
    );
  }
}

export function getActualFormatSize(
  format: YtDlpFormat,
  metadata: YtDlpMetadata,
): number {
  if (typeof format?.filesize === "number" && format.filesize > 0) {
    return format.filesize;
  }

  if (
    typeof format?.filesize_approx === "number" &&
    format.filesize_approx > 0
  ) {
    return format.filesize_approx;
  }

  let parentSize = 0;
  if (
    typeof metadata.filesize_approx === "number" &&
    metadata.filesize_approx > 0
  ) {
    parentSize = metadata.filesize_approx;
  } else if (
    Array.isArray(metadata.requested_downloads) &&
    metadata.requested_downloads[0] &&
    typeof metadata.requested_downloads[0].filesize_approx === "number"
  ) {
    parentSize = metadata.requested_downloads[0].filesize_approx;
  } else if (typeof metadata.filesize === "number" && metadata.filesize > 0) {
    parentSize = metadata.filesize;
  }

  if (parentSize > 0) {
    const bestHeight = metadata.height || 1080;
    const thisHeight = format?.height || 720;
    if (bestHeight > 0 && thisHeight > 0) {
      const heightRatio = thisHeight / bestHeight;
      const scaled = Math.round(parentSize * heightRatio * 0.85);
      if (scaled > 0) {
        return scaled;
      }
    }
  }

  const bitrateKbps = format?.tbr || format?.abr || format?.vbr || 0;
  const duration = format?.duration || metadata.duration || 0;
  if (bitrateKbps > 0 && duration > 0) {
    const sizeBytes = Math.round((bitrateKbps * 1000 * duration) / 8);
    if (sizeBytes > 0) {
      return sizeBytes;
    }
  }

  return 0;
}

function estimateSize(metadata: YtDlpMetadata): number {
  const raw =
    metadata.filesize ??
    metadata.filesize_approx ??
    metadata.requested_downloads?.[0]?.filesize ??
    metadata.requested_downloads?.[0]?.filesize_approx;

  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  const formats = Array.isArray(metadata.formats) ? metadata.formats : [];
  if (formats.length > 0) {
    const best =
      formats.find((f) => f.format_id === metadata.format_id) || formats[0];
    return getActualFormatSize(best, metadata);
  }

  return 0;
}

async function getFormatSize(url: string, profileId: string): Promise<number> {
  const metadata = await getMetadata(url);
  const formats = Array.isArray(metadata.formats) ? metadata.formats : [];
  const matched = formats.find((format) => format.format_id === profileId);
  if (!matched) {
    return 0;
  }

  return getActualFormatSize(matched, metadata);
}

async function createQueuedFile(
  sessionId: string,
  url: string,
  estimatedSize: number,
): Promise<{ fileId: string; status: "queued" }> {
  const key = `pending/${randomUUID()}`;

  const insert = await getPostgresPool().query<{
    id: string;
    status: "queued";
  }>(
    `INSERT INTO files ("key", "sourceUrl", "size", "status", "sessionId")
     VALUES ($1, $2, $3, 'queued', $4)
     RETURNING "id", "status"`,
    [key, url, String(estimatedSize), sessionId],
  );

  return {
    fileId: insert.rows[0].id,
    status: insert.rows[0].status,
  };
}

export async function submitVideoDownloadJob(payload: {
  url: string;
  profileId?: string;
}): Promise<VideoJobCreateResponse> {
  const enableNewRequests = getBooleanEnv("ENABLE_NEW_REQUESTS", true);
  if (!enableNewRequests) {
    throw createHttpFailure(
      503,
      "New requests are currently disabled",
      "Service Unavailable",
    );
  }

  const sessionId = await ensureSessionId();
  await touchSession(sessionId);

  const sourceUrl = ensureValidUrl(payload.url);
  const maxJobs = getNumberEnv("SESSION_MAX_JOBS", 5);
  const sessionJobs = await incrementSessionJobs(sessionId);

  if (sessionJobs > maxJobs) {
    throw createHttpFailure(
      403,
      "Session has exceeded job rate limit",
      "Forbidden",
    );
  }

  let estimatedSize: number;
  if (payload.profileId) {
    estimatedSize = await getFormatSize(sourceUrl, payload.profileId);
    if (estimatedSize <= 0) {
      throw createHttpFailure(
        400,
        "Unable to determine file size for selected format",
        "Bad Request",
      );
    }
  } else {
    const metadata = await getMetadata(sourceUrl);
    estimatedSize = estimateSize(metadata);

    if (estimatedSize <= 0) {
      throw createHttpFailure(
        400,
        "Unable to estimate file size for this source. Try using the profile selection first.",
        "Bad Request",
      );
    }
  }

  const maxFileBytes = getNumberEnv("MAX_FILE_BYTES", 1_000_000_000);
  const sessionMaxBytes = getNumberEnv("SESSION_MAX_BYTES", 500_000_000);
  const maxStorageBytes = getNumberEnv("MAX_STORAGE_BYTES", 10_000_000_000);

  if (estimatedSize > maxFileBytes) {
    throw createHttpFailure(
      400,
      "Requested file exceeds max file size",
      "Bad Request",
    );
  }

  if (estimatedSize > sessionMaxBytes) {
    throw createHttpFailure(
      400,
      "Requested file exceeds per-session storage quota",
      "Bad Request",
    );
  }

  const [sessionBytes, storageUsed] = await Promise.all([
    getRedisNumber(`session:${sessionId}:bytes_used`),
    getRedisNumber(STORAGE_USED_KEY),
  ]);

  if (sessionBytes + estimatedSize > sessionMaxBytes) {
    const dbSessionBytes = await getSessionBytesFromDb(sessionId);
    if (dbSessionBytes !== sessionBytes) {
      await setSessionBytes(sessionId, dbSessionBytes);
    }

    if (dbSessionBytes + estimatedSize > sessionMaxBytes) {
      throw createHttpFailure(
        403,
        "Session storage quota exceeded",
        "Forbidden",
      );
    }
  }

  if (storageUsed + estimatedSize > maxStorageBytes) {
    const queued = await createQueuedFile(sessionId, sourceUrl, estimatedSize);
    return {
      fileId: queued.fileId,
      jobId: null,
      estimatedSize,
      status: queued.status,
    };
  }

  await Promise.all([
    reserveSessionBytes(sessionId, estimatedSize),
    incrementStorageUsed(estimatedSize),
  ]);

  try {
    const key = `pending/${randomUUID()}`;
    const created = await getPostgresPool().query<{ id: string }>(
      `INSERT INTO files ("key", "sourceUrl", "size", "status", "sessionId")
       VALUES ($1, $2, $3, 'processing', $4)
       RETURNING "id"`,
      [key, sourceUrl, String(estimatedSize), sessionId],
    );

    const fileId = created.rows[0].id;
    const job = await getQueueClient().add(
      DOWNLOAD_JOB_NAME,
      {
        fileId,
        url: sourceUrl,
        sessionId,
        reservedBytes: estimatedSize,
        profileId: payload.profileId,
      },
      {
        attempts: 2,
        backoff: {
          type: "exponential",
          delay: 1500,
        },
        removeOnComplete: 200,
        removeOnFail: 500,
      },
    );

    await getPostgresPool().query(
      `UPDATE files SET "queueJobId" = $1 WHERE "id" = $2`,
      [String(job.id), fileId],
    );

    return {
      fileId,
      jobId: String(job.id),
      estimatedSize,
      status: "processing",
    };
  } catch (error) {
    await Promise.all([
      releaseSessionBytes(sessionId, estimatedSize),
      decrementStorageUsed(estimatedSize),
    ]);

    if (
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      "message" in error
    ) {
      throw error;
    }

    throw createHttpFailure(500, String(error), "Internal Server Error");
  }
}
