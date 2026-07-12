# Video Downloader Production Architecture

## Decision Baseline

ADR-0001 is accepted: Next.js owns the user-facing frontend, and the Nest backend owns video job intake, worker processing, storage, cleanup, sessions, quotas, migrations, and operational health.

The product depends on long-running `yt-dlp` work, BullMQ workers, R2 upload/delete, reservation reconciliation, and cleanup scheduling. Those behaviours run in backend runtimes, not in Next route handlers.

## Runtime Shape

One backend codebase ships two production runtimes:

- API runtime: `pnpm run runtime:api`
- Worker runtime: `pnpm run runtime:worker`

Migrations run as a separate operational command:

- Migration job: `pnpm run runtime:migrate`

The Docker image defaults to the API runtime. Worker deployments use the same image with the worker command.

## Frontend

The frontend is a Next.js UI adapter.

Responsibilities:

- Collect a supported video URL.
- Display backend-provided profile options.
- Submit profile-aware download jobs to the backend.
- Persist recent file IDs locally.
- Poll backend file status.
- Open backend download redirects for ready files.
- Display runtime health from `GET /system/health`.

The frontend must not duplicate backend lifecycle implementation. It calls the Nest backend through `frontend/api/*` and deeper client flow modules under `frontend/modules/*`.

## Backend API

Responsibilities:

- Create and maintain anonymous sessions.
- Validate download requests.
- Discover yt-dlp profiles and estimate sizes.
- Apply session and storage admission rules.
- Reserve quota before queue insertion.
- Enqueue BullMQ work.
- Report file status for the owning session.
- Redirect ready downloads to signed R2 URLs.
- Report runtime health.

Important modules:

- `modules/video/download-intake.service.ts`
- `modules/video/profile-catalogue.service.ts`
- `modules/video/download-reservation.service.ts`
- `modules/video/download-file-access.service.ts`
- `modules/runtime/runtime-operations.service.ts`

## Backend Worker

Responsibilities:

- Consume BullMQ download jobs.
- Resolve selected download format.
- Run `yt-dlp` with `ffmpeg` support.
- Stream output to R2.
- Mark files ready or failed.
- Release or reconcile reservations.
- Promote queued downloads when capacity returns.
- Delete expired files.
- Recover stale processing jobs.

Important modules:

- `modules/video/download-worker-lifecycle.service.ts`
- `modules/video/download-format-resolver.service.ts`
- `modules/video/download-cleanup-coordinator.service.ts`
- `modules/video/download-processing-recovery.service.ts`
- `modules/video/queued-download-promotion.service.ts`

## Runtime Health

The API health endpoint is:

```text
GET /system/health
```

It reports:

- `postgres`: database connectivity.
- `redis`: Redis connectivity.
- `queue`: BullMQ queue reachability and queue counts.
- `worker`: connected BullMQ worker count.
- `ytDlp`: executable readiness.
- `ffmpeg`: executable readiness.

Queue reachability does not imply worker availability. If the queue is reachable but no worker is connected, the runtime status is `degraded`.

## Storage And Cleanup

Cloudflare R2 stores temporary downloaded files. Files are associated with anonymous sessions and expire after the configured TTL.

Cleanup is owned by the worker runtime. The API can report state and redirect downloads, but it does not run cleanup scheduling or background processing.

## Operational Requirements

- Run API and worker as separate processes.
- Run migrations before deploying a new backend version.
- Provide `yt-dlp` and `ffmpeg` either on `PATH` or via `YTDLP_BINARY_PATH` and `FFMPEG_BINARY_PATH`.
- Keep Redis and Postgres reachable by both API and worker runtimes.
- Treat `GET /system/health` as degraded when any required runtime dependency is unavailable.
