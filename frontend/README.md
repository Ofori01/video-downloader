This is a [Next.js](https://nextjs.org) project for the Video Downloader frontend.

## Getting Started

1. Copy environment variables:

```bash
cp .env.example .env.local
```

2. Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3001](http://localhost:3001) with your browser to see
the result. Keep the Nest backend running on port `3000` so browser requests can
reach `NEXT_PUBLIC_API_BASE_URL`.

## Frontend Data Architecture

This frontend is a UI adapter over the Nest backend. It does not own the download lifecycle.

- Global types: `types/*`
- API layer (HTTP only): `api/*`
- Deep client flow modules: `modules/*`
- Shared frontend utilities: `lib/*`
- Global query provider: `app/providers.tsx`

### Request stack

- `axios` is used via a shared client in `api/http-client.ts`
- `@tanstack/react-query` handles queries, mutations, cache, retries, and polling
- `modules/client-job-flow` owns URL normalization, profile-aware submission, local job persistence, optimistic status, polling, and job view-model mapping

### Error handling and retries

- Errors are normalized in `api/error.ts`
- Query retries are enabled only for retryable/network/server failures
- Mutation retries are conservative (network-only, single retry) to reduce duplicate job creation risk

### Environment

- `NEXT_PUBLIC_API_BASE_URL` controls the Nest backend base URL for browser requests
- The local default is `http://localhost:3000`
- Requests are made with credentials enabled for session cookie support
- The Nest backend owns video job intake, worker processing, storage, cleanup, sessions, quotas, migrations, and operational health
- The system snapshot displays queue reachability separately from worker availability

## UI Foundation

- Official `shadcn` setup is enabled (`components.json`)
- Reusable design tokens and theme variables are defined in `app/globals.css`
- Components consume global tokens for consistency across the project

## Scripts

```bash
npm run dev
npm run lint
npm run build
```
