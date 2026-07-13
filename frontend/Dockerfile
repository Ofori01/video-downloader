# syntax=docker/dockerfile:1.7

FROM node:20-slim AS base

WORKDIR /app

ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}

RUN corepack enable

FROM base AS deps

COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=frontend-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store

FROM deps AS pruner

RUN pnpm prune --prod \
    && pnpm store prune \
    && rm -rf node_modules/@next/*-musl node_modules/@img/*musl*

FROM base AS builder

ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_BASE_URL=/
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm run build

FROM base AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/package.json ./package.json
COPY --from=pruner /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts

EXPOSE 3000

CMD ["pnpm", "exec", "next", "start", "--hostname", "0.0.0.0"]
