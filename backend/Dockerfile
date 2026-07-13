# syntax=docker/dockerfile:1.7

FROM node:20-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

RUN corepack enable

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=backend-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts --store-dir /pnpm/store

FROM deps AS build

COPY . .

RUN pnpm run build

FROM base AS prod-deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=backend-pnpm-store,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile --ignore-scripts --store-dir /pnpm/store

FROM base AS api-runtime

ENV NODE_ENV=production

COPY package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

CMD ["pnpm", "run", "runtime:api"]

FROM base AS media-base

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
      ca-certificates \
      python3 \
      python3-pip

RUN --mount=type=cache,id=backend-pip-cache,target=/root/.cache/pip \
    python3 -m pip install --break-system-packages yt-dlp

FROM base AS ffmpeg-tools

ARG TARGETARCH
ARG FFMPEG_BUILD_TAG=autobuild-2026-07-12-15-07
ARG FFMPEG_BUILD_ID=ffmpeg-N-125551-ga09be9b91e
ARG FFMPEG_LINUX64_SHA256=7a19456683e31d937ae48d51e23dfb869dbb9db1e4d6e1b6881d7fed168fa5cf
ARG FFMPEG_LINUXARM64_SHA256=aabd3f9d8e7ad8b118fd8cd9cf32158212faf4a0eb77736116c1c8f155d813cd

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      xz-utils

RUN case "${TARGETARCH}" in \
      amd64) ffmpeg_arch="linux64"; ffmpeg_sha="${FFMPEG_LINUX64_SHA256}" ;; \
      arm64) ffmpeg_arch="linuxarm64"; ffmpeg_sha="${FFMPEG_LINUXARM64_SHA256}" ;; \
      *) echo "Unsupported TARGETARCH: ${TARGETARCH}" >&2; exit 1 ;; \
    esac \
    && ffmpeg_asset="${FFMPEG_BUILD_ID}-${ffmpeg_arch}-gpl.tar.xz" \
    && ffmpeg_url="https://github.com/yt-dlp/FFmpeg-Builds/releases/download/${FFMPEG_BUILD_TAG}/${ffmpeg_asset}" \
    && curl -fsSL "${ffmpeg_url}" -o /tmp/ffmpeg.tar.xz \
    && echo "${ffmpeg_sha}  /tmp/ffmpeg.tar.xz" | sha256sum -c - \
    && mkdir -p /tmp/ffmpeg \
    && tar -xJf /tmp/ffmpeg.tar.xz -C /tmp/ffmpeg --strip-components=1 \
    && cp /tmp/ffmpeg/bin/ffmpeg /usr/local/bin/ffmpeg \
    && cp /tmp/ffmpeg/bin/ffprobe /usr/local/bin/ffprobe \
    && chmod +x /usr/local/bin/ffmpeg /usr/local/bin/ffprobe \
    && /usr/local/bin/ffmpeg -version >/dev/null \
    && /usr/local/bin/ffprobe -version >/dev/null

FROM media-base AS worker-runtime

ENV NODE_ENV=production
ENV FFMPEG_BINARY_PATH=/usr/local/bin/ffmpeg
ENV YTDLP_BINARY_PATH=/usr/local/bin/yt-dlp

COPY package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=ffmpeg-tools /usr/local/bin/ffmpeg /usr/local/bin/ffmpeg
COPY --from=ffmpeg-tools /usr/local/bin/ffprobe /usr/local/bin/ffprobe

RUN pnpm run runtime:check:binaries

CMD ["pnpm", "run", "runtime:worker"]
