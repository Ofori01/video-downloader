import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { VideoFile } from "@/types";
import {
  createHttpFailure,
  ensureSessionId,
  getNumberEnv,
  getRedisClient,
  getStringEnv,
  touchSession,
} from "@/lib/server/video-jobs";
import { queryWithRetry } from "@/lib/server/postgres";

type GlobalWithStorageClient = typeof globalThis & {
  __vdStorageS3Client?: S3Client;
};

const globalStorage = globalThis as GlobalWithStorageClient;

type FileRow = {
  id: string;
  key: string;
  sourceUrl: string;
  size: string | null;
  status: VideoFile["status"];
  sessionId: string;
  createdAt: Date;
  downloadedAt: Date | null;
  expiresAt: Date | null;
  queueJobId: string | null;
  errorReason: string | null;
};

function getStorageClient(): S3Client {
  if (!globalStorage.__vdStorageS3Client) {
    globalStorage.__vdStorageS3Client = new S3Client({
      endpoint: getStringEnv("R2_ENDPOINT"),
      region: getStringEnv("R2_REGION", "auto"),
      forcePathStyle: true,
      credentials: {
        accessKeyId: getStringEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: getStringEnv("R2_SECRET_ACCESS_KEY"),
      },
    });
  }

  return globalStorage.__vdStorageS3Client;
}

function toVideoFile(row: FileRow): VideoFile {
  return {
    id: row.id,
    key: row.key,
    sourceUrl: row.sourceUrl,
    size: row.size,
    status: row.status,
    sessionId: row.sessionId,
    createdAt: row.createdAt.toISOString(),
    downloadedAt: row.downloadedAt ? row.downloadedAt.toISOString() : null,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    queueJobId: row.queueJobId,
    errorReason: row.errorReason,
  };
}

async function getOwnedFile(
  fileId: string,
  sessionId: string,
): Promise<FileRow> {
  const result = await queryWithRetry<FileRow>(
    `SELECT
       "id",
       "key",
       "sourceUrl",
       "size"::text AS "size",
       "status",
       "sessionId",
       "createdAt",
       "downloadedAt",
       "expiresAt",
       "queueJobId",
       "errorReason"
     FROM files
     WHERE "id" = $1
       AND "sessionId" = $2
     LIMIT 1`,
    [fileId, sessionId],
  );

  const file = result.rows[0];
  if (!file) {
    throw createHttpFailure(404, "File not found", "Not Found");
  }

  return file;
}

async function getSignedDownloadUrl(key: string): Promise<string> {
  const filename = key.split("/").pop() || "download.mp4";
  const command = new GetObjectCommand({
    Bucket: getStringEnv("R2_BUCKET"),
    Key: key,
    ResponseContentDisposition: `attachment; filename="${filename}"`,
  });

  return getSignedUrl(getStorageClient(), command, {
    expiresIn: getNumberEnv("SIGNED_URL_TTL_SECONDS", 900),
  });
}

export async function getVideoFileStatus(fileId: string): Promise<VideoFile> {
  const sessionId = await ensureSessionId();
  await touchSession(sessionId);

  const file = await getOwnedFile(fileId, sessionId);
  return toVideoFile(file);
}

export async function getVideoDownloadRedirectUrl(
  fileId: string,
): Promise<string> {
  const sessionId = await ensureSessionId();
  await touchSession(sessionId);

  const file = await getOwnedFile(fileId, sessionId);
  if (file.status !== "ready") {
    throw createHttpFailure(
      400,
      "File is not ready for download",
      "Bad Request",
    );
  }

  if (!file.downloadedAt) {
    const fileTtlSeconds = Math.min(
      getNumberEnv("FILE_TTL_SECONDS", 3600),
      3600,
    );
    const expiresAt =
      file.expiresAt ?? new Date(Date.now() + fileTtlSeconds * 1000);

    await queryWithRetry(
      `UPDATE files
       SET "downloadedAt" = NOW(),
           "expiresAt" = COALESCE("expiresAt", $2)
       WHERE "id" = $1`,
      [file.id, expiresAt],
    );
  }

  await getRedisClient().incrby(`session:${sessionId}:downloads`, 1);
  return getSignedDownloadUrl(file.key);
}
