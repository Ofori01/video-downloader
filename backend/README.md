# Video Downloader Backend

This backend uses one NestJS codebase with two production runtimes:

- API runtime: accepts HTTP requests, manages anonymous sessions, performs profile discovery and admission checks, enqueues BullMQ jobs, serves file status, and redirects ready downloads.
- Worker runtime: consumes BullMQ jobs, runs `yt-dlp`/`ffmpeg`, streams downloads to R2, updates file lifecycle state, reconciles reservations, promotes queued downloads, and runs cleanup.

ADR-0001 makes the backend the owner of video job intake, worker processing, storage, cleanup, sessions, quotas, migrations, and operational health.

## Local Setup

```bash
cp .env.example .env
pnpm install
```

Fill all required values in `.env`. Leave `YTDLP_BINARY_PATH` and `FFMPEG_BINARY_PATH` empty to use binaries from `PATH`.

`FRONTEND_ORIGIN` controls browser CORS access. Use a comma-separated list when running the frontend on more than one local origin, for example:

```bash
FRONTEND_ORIGIN=http://localhost:3001,http://localhost:3100
```

## Development Runtimes

Run the API and worker in separate terminals:

```bash
pnpm run start:api:dev
pnpm run start:worker:dev
```

The frontend expects the API on `http://localhost:3000`.

## Production Runtimes

```bash
pnpm run build

pnpm run runtime:api
pnpm run runtime:worker
pnpm run runtime:migrate
```

Deployment commands:

- API service: `pnpm run runtime:api`
- Worker service: `pnpm run runtime:worker`
- Migration job: `pnpm run runtime:migrate`

## Runtime Readiness

The API health endpoint is `GET /system/health`.

It reports separate checks for:

- `postgres`: database connectivity
- `redis`: Redis connectivity
- `queue`: BullMQ queue reachability and queue counts
- `worker`: connected BullMQ worker count
- `ytDlp`: `yt-dlp` executable readiness
- `ffmpeg`: `ffmpeg` executable readiness

Queue reachability does not mean the worker is running. The health status is `degraded` when the queue is reachable but no worker is connected, because submitted downloads would not complete.

## Binary Readiness

The Docker image installs `ffmpeg` and `yt-dlp`, then verifies both during build:

```bash
pnpm run runtime:check:binaries
```

For custom binary locations, set:

```bash
YTDLP_BINARY_PATH=/absolute/path/to/yt-dlp
FFMPEG_BINARY_PATH=/absolute/path/to/ffmpeg
```

## Tests

```bash
pnpm run test
pnpm run test:e2e
pnpm run lint
pnpm run build
```
