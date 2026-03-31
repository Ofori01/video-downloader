# Video Download Service Architecture (yt-dlp + NestJS + R2)

## 📌 Overview

This project is a scalable video download service that:

1. Accepts a video URL (e.g., YouTube)
2. Processes the video using `yt-dlp`
3. Uploads the video to object storage
4. Provides a temporary download link to the user
5. Automatically deletes the file after a defined time

The system is designed to:

* Avoid disk usage
* Handle concurrent users safely
* Respect storage limits
* Scale efficiently using queues and workers
* Track anonymous users via sessions (no login required)

---

# 🧠 CRITICAL ARCHITECTURE DECISION

## Single Codebase, Multiple Entry Points

This project uses **ONE NestJS codebase** but runs:

* **API Service (HTTP server)**
* **Worker Service (background processor)**

👉 These are deployed as **separate services**, but share the same code.

---

# 🏗️ High-Level Architecture

## Components

### 1. Frontend (Next.js)

* Hosted on Vercel
* Handles user input (video URL)
* Displays job status
* Provides download link
* Admin dashboard (protected)

---

### 2. Backend API (NestJS - Render Web Service)

Responsibilities:

* Accept requests
* Manage user sessions (anonymous)
* Validate input
* Estimate file size
* Perform storage admission control
* Enqueue jobs in BullMQ
* Serve download endpoint (redirect)
* Provide admin metrics endpoints

---

### 3. Worker (NestJS - Render Worker Service)

Responsibilities:

* Consume jobs from BullMQ
* Run `yt-dlp`
* Stream video to storage (R2)
* Update database
* Handle retries

---

### 4. Storage (Cloudflare R2)

* Temporary file storage
* Provides signed download URLs
* Files are deleted after TTL

---

### 5. Queue (BullMQ + Redis)

* Job queue system
* Enables async processing
* Handles retries and concurrency
* Enables backpressure when storage is full

---

### 6. Database (PostgreSQL)

* Source of truth
* Stores:

  * file metadata
  * session data

---

### 7. Cache (Redis)

Used for:

* Storage usage tracking
* Session counters
* Queue (BullMQ)
* Rate limiting

---

# 👤 Session System (NO AUTH REQUIRED)

## Goal

Track users without requiring login.

---

## How it works

### 1. Session Creation

* On first request:

  * Generate `sessionId` (UUID)
  * Set cookie:

```text
sessionId=<uuid>; HttpOnly; Secure; SameSite=Lax; Max-Age=86400
```

---

### 2. Session Middleware (NestJS)

Every request must:

* Read `sessionId` from cookie
* If missing → create new session
* Attach session to request context

---

### 3. Database Schema (sessions)

| Field        | Description |
| ------------ | ----------- |
| id           | sessionId   |
| createdAt    | timestamp   |
| lastSeenAt   | timestamp   |
| requestCount | number      |

---

### 4. Link Sessions to Files

Update `files` table:

| Field     | Description   |
| --------- | ------------- |
| sessionId | owner of file |

---

### 5. Redis Session Keys

```ts
session:{id}:downloads
session:{id}:jobs
session:{id}:bytes_used
```

---

## Session-Based Features

* Rate limiting per session
* Usage tracking per session
* Abuse detection
* Cleanup prioritization

---

# 🔄 System Flow

1. User visits app → session created
2. User submits video URL
3. API validates URL
4. API gets metadata via yt-dlp (no download)
5. API estimates file size
6. API checks Redis storage usage
7. API checks session limits
8. If allowed:

   * Reserve storage
   * Increment session usage
   * Add job to queue
9. Worker processes job:

   * Runs yt-dlp
   * Streams to R2
10. On success:

* Save file metadata
* Mark file as ready

11. User downloads via `/download/:id`
12. API:

* Marks `downloadedAt`
* Sets TTL
* Redirects to R2 URL

13. Cleanup job deletes expired files

---

# 🐳 Docker Setup (MANDATORY)

## Dockerfile

```dockerfile
FROM node:20-slim

RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

CMD ["node", "dist/main.js"]
```

---

# 🧠 NestJS Structure

```plaintext
src/
  main.ts
  worker.ts

  app.module.ts
  worker.module.ts

  modules/
    video/
    session/
    admin/
```

---

# ⚙️ BullMQ Integration

## API (Producer)

```ts
await queue.add("download-video", { url, sessionId });
```

---

## Worker (Consumer)

```ts
new Worker("video-queue", async (job) => {
  // process video
});
```

---

# 🚀 Render Deployment

## Web Service

```bash
node dist/main.js
```

---

## Worker Service

```bash
node dist/worker.js
```

---

# 📦 Core Features

---

## Storage Tracking (Redis)

```ts
storage_used
```

---

## Streaming Upload

```ts
yt-dlp stdout → stream → R2
```

---

## Download Endpoint

```http
GET /download/:id
```

* Marks file accessed
* Sets TTL
* Redirects to signed URL

---

# 📊 Admin Dashboard

## Built with Next.js

Protected route: `/admin`

---

## Metrics to Display

### System Health

* Active jobs
* Queue size
* Failed jobs

### Storage

* Total storage used
* Usage %
* File count

### Sessions

* Active sessions
* Top sessions (usage)
* Requests per session

### Usage

* Total downloads
* Uploads (jobs)
* Avg processing time

---

## Admin Controls

### Storage Controls

* Set MAX_STORAGE
* Set MAX_FILE_SIZE
* Set TTL

---

### Queue Controls

* Pause/resume queue
* Retry failed jobs

---

### System Controls

* Enable/disable new requests
* Maintenance mode

---

# 🔐 Security

* HttpOnly cookies
* Input validation
* Rate limiting per session
* Admin route protection

---

# 🚨 Rate Limiting (Session-Based)

Example rules:

```ts
max 5 jobs / 10 minutes
max 500MB per session
```

---

# 🧹 Cleanup Job

* Runs periodically
* Deletes expired files
* Updates Redis + DB
* Frees storage

---

# 📊 Database Schema

## files

| Field        | Description                  |
| ------------ | ---------------------------- |
| id           | UUID                         |
| key          | R2 key                       |
| size         | bytes                        |
| status       | processing / ready / deleted |
| sessionId    | owner                        |
| createdAt    | timestamp                    |
| downloadedAt | timestamp                    |
| expiresAt    | timestamp                    |

---

## sessions

| Field        | Description |
| ------------ | ----------- |
| id           | sessionId   |
| createdAt    | timestamp   |
| lastSeenAt   | timestamp   |
| requestCount | number      |

---

# 🔑 Redis Keys

```ts
storage_used

session:{id}:downloads
session:{id}:jobs
session:{id}:bytes_used

jobs:active
jobs:failed
jobs:completed
```

---

# ⚙️ Worker Responsibilities

* Execute yt-dlp
* Stream to R2
* Update DB
* Handle retries

---

# 🚨 Constraints

* Max file size per request
* Max total storage
* Max usage per session

---

# 🧠 Design Rules

## MUST DO

* Use sessions (no login)
* Use Redis for fast tracking
* Use queue for processing
* Use streaming (no disk)

---

## MUST NOT DO

* Do NOT process yt-dlp in API
* Do NOT store files locally
* Do NOT require user login

---

# 🚀 Summary

This system:

* Uses session-based tracking (no auth)
* Uses Redis for performance
* Uses BullMQ for async jobs
* Uses R2 for storage
* Uses TTL cleanup
* Uses admin dashboard for control

---

# 📌 FINAL IMPLEMENTATION NOTES FOR SONNET

* Implement session middleware
* Store sessionId in cookie
* Track session usage in Redis
* Link files to sessions
* Build admin dashboard endpoints
* Use Redis for metrics
* Keep API and worker separate

---
# Video Download Service Architecture (yt-dlp + NestJS + R2)

> Updated to include clean, production-grade folder structure for both backend (NestJS) and frontend (Next.js)

---

# 🏗️ Folder Structure

This structure is designed for **scalability, maintainability, and clarity**, following best practices for Next.js and NestJS.

---

## Backend (NestJS)

```plaintext id="6l2wqd"
backend/
├─ Dockerfile                   # Docker setup
├─ package.json
├─ tsconfig.json
├─ .env                         # environment variables
├─ dist/                         # compiled JS (ignored in source)
├─ src/
│  ├─ main.ts                   # API entry point
│  ├─ worker.ts                 # Worker entry point
│  ├─ app.module.ts             # Root module
│  ├─ app.controller.ts         # Basic health check / root routes
│  ├─ common/                   # Shared utilities, filters, interceptors
│  │  ├─ guards/
│  │  ├─ interceptors/
│  │  ├─ filters/
│  │  └─ decorators/
│  ├─ config/                   # Environment config and constants
│  ├─ modules/
│  │  ├─ video/
│  │  │  ├─ video.module.ts
│  │  │  ├─ video.service.ts
│  │  │  ├─ video.controller.ts
│  │  │  └─ video.processor.ts   # BullMQ processor
│  │  ├─ session/
│  │  │  ├─ session.module.ts
│  │  │  ├─ session.service.ts
│  │  │  └─ session.middleware.ts
│  │  ├─ admin/
│  │  │  ├─ admin.module.ts
│  │  │  ├─ admin.controller.ts
│  │  │  └─ admin.service.ts
│  │  └─ queue/
│  │     ├─ queue.module.ts
│  │     ├─ queue.service.ts
│  │     └─ bull.config.ts
│  ├─ entities/                 # TypeORM or Prisma entities/models
│  │  ├─ file.entity.ts
│  │  └─ session.entity.ts
│  ├─ repository/               # Database abstraction layer
│  ├─ utils/                    # Helper functions (storage, streaming, etc.)
│  └─ interfaces/               # TypeScript interfaces & DTOs
└─ tests/                        # Unit and e2e tests
```

**Notes on backend structure:**

* `main.ts` → API bootstrap
* `worker.ts` → Worker bootstrap
* `modules/` → feature-based modular structure (video, session, admin)
* `common/` → reusable components (guards, interceptors, decorators)
* `queue/` → BullMQ configuration and services
* `entities/` → Database models (PostgreSQL)
* `utils/` → Streaming, storage, file processing helpers

---

## Frontend (Next.js)

```plaintext id="3kf8wa"
frontend/
├─ package.json
├─ tsconfig.json
├─ next.config.js
├─ public/                     # Static assets
│  ├─ favicon.ico
│  └─ images/
├─ styles/                     # Global CSS / Tailwind config
├─ components/                 # Reusable UI components
│  ├─ layout/
│  ├─ buttons/
│  ├─ tables/
│  └─ modals/
├─ hooks/                      # Custom React hooks
├─ pages/                      # Next.js pages
│  ├─ index.tsx                # Home page
│  ├─ download/[id].tsx        # Download page
│  ├─ admin/                   # Admin dashboard pages
│  │  ├─ index.tsx             # Dashboard overview
│  │  ├─ files.tsx
│  │  ├─ jobs.tsx
│  │  └─ settings.tsx
│  └─ api/                     # Optional Next.js API routes (proxy to Nest backend)
├─ context/                    # React context providers (user session, auth, etc.)
├─ services/                   # API client, fetchers, utilities
│  ├─ apiClient.ts
│  └─ sessionService.ts
├─ utils/                      # Misc helpers (formatting, validation)
└─ tests/                      # Unit and integration tests
```

**Notes on frontend structure:**

* `pages/` → Next.js routing structure (admin under `/admin`)
* `components/` → modular, reusable UI components
* `hooks/` → custom logic for sessions, jobs, API fetching
* `context/` → global state for user sessions or admin analytics
* `services/` → API interaction layer (NestJS backend)

---

# 🧩 Integration Points

* **Session management:** backend session middleware → frontend reads `sessionId` cookie
* **Download flow:** frontend calls API → API enqueues job → worker streams to R2 → frontend polls for readiness → download link provided
* **Admin dashboard:** frontend calls backend admin endpoints → fetches Redis + DB metrics

---

# 🚀 Key Takeaways

1. Backend follows **feature-module pattern** (NestJS best practices)
2. Worker and API share codebase but have **separate entry points**
3. Frontend is modular, scalable, and includes **admin dashboard**
4. Sessions are cookie-based, no login required
5. Storage, job queue, and session tracking all use **Redis**
6. R2 is the temporary storage, files cleaned up via TTL

---

This folder structure is **production-ready**, supports scaling, and clearly separates concerns for frontend, backend, worker, and admin functionality.

---

We can now integrate this folder structure directly into the Sonnet MD instructions so they understand **how to organize the code**.

End of document.
