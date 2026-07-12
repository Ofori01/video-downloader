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

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Frontend Data Architecture

This frontend follows a standardized layered approach:

- Global types: `types/*`
- API layer (HTTP only): `api/*`
- Service layer (view/domain mapping): `services/*`
- Query hooks: `hooks/*`
- Global query provider: `app/providers.tsx`

### Request stack

- `axios` is used via a shared client in `api/http-client.ts`
- `@tanstack/react-query` handles queries, mutations, cache, retries, and polling

### Error handling and retries

- Errors are normalized in `api/error.ts`
- Query retries are enabled only for retryable/network/server failures
- Mutation retries are conservative (network-only, single retry) to reduce duplicate job creation risk

### Environment

- Browser requests default to same-origin `/api` via Next Route Handlers
- `NEXT_PUBLIC_API_BASE_URL` is optional and defaults to `/api`
- Native Next API runtime uses server-side env vars for Postgres, Redis, queue, and R2 integrations
- Requests are made with credentials enabled for session cookie support

### Migration status

- `GET /api/system/health` is implemented natively in Next.js server runtime (no Nest proxy)
- `POST /api/video/jobs` is implemented natively in Next.js server runtime (no Nest proxy)
- `GET /api/video/files/:id` is implemented natively in Next.js server runtime (no Nest proxy)
- `GET /api/download/:id` is implemented natively in Next.js server runtime (no Nest proxy)
- `GET /api/video/profiles` is implemented natively in Next.js server runtime (no Nest proxy)

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
