# syntax=docker/dockerfile:1.7

FROM node:20-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,id=frontend-npm-cache,target=/root/.npm \
    npm ci

FROM deps AS pruner

RUN npm prune --omit=dev \
    && npm cache clean --force \
    && rm -rf node_modules/@next/*-musl node_modules/@img/*musl*

FROM node:20-slim AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_BASE_URL=/
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/package.json ./package.json
COPY --from=pruner /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts

EXPOSE 3000

CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0"]
