import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().integer().min(1).max(65535).default(3000),
  FRONTEND_ORIGIN: Joi.string().uri().required(),

  DATABASE_URL: Joi.string().uri().required(),
  REDIS_URL: Joi.string().uri().required(),

  QUEUE_NAME: Joi.string().default('video-queue'),
  WORKER_CONCURRENCY: Joi.number().integer().min(1).max(50).default(3),

  SESSION_COOKIE_NAME: Joi.string().default('sessionId'),
  SESSION_COOKIE_MAX_AGE_SECONDS: Joi.number().integer().min(60).default(86400),
  SESSION_COOKIE_SECURE: Joi.boolean().default(true),

  SESSION_MAX_JOBS: Joi.number().integer().min(1).default(5),
  SESSION_WINDOW_SECONDS: Joi.number().integer().min(60).default(600),
  SESSION_MAX_BYTES: Joi.number().integer().min(1).default(500_000_000),
  MAX_FILE_BYTES: Joi.number().integer().min(1).default(1_000_000_000),
  MAX_STORAGE_BYTES: Joi.number().integer().min(1).default(10_000_000_000),

  FILE_TTL_SECONDS: Joi.number().integer().min(60).max(3600).default(3600),
  SIGNED_URL_TTL_SECONDS: Joi.number().integer().min(60).default(900),
  PROCESSING_STALE_AFTER_SECONDS: Joi.number()
    .integer()
    .min(600)
    .default(21600),

  ENABLE_NEW_REQUESTS: Joi.boolean().default(true),

  R2_ENDPOINT: Joi.string().uri().required(),
  R2_REGION: Joi.string().default('auto'),
  R2_BUCKET: Joi.string().required(),
  R2_ACCESS_KEY_ID: Joi.string().required(),
  R2_SECRET_ACCESS_KEY: Joi.string().required(),

  YTDLP_BINARY_PATH: Joi.string().allow('').optional(),
  FFMPEG_BINARY_PATH: Joi.string().allow('').optional(),
});
