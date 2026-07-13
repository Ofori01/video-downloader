# Hostinger VPS Backend Deployment

This deployment keeps WordPress/nginx on the VPS and runs only the video
downloader backend services in Docker:

- `backend-api` on `127.0.0.1:3100`
- `backend-worker` with no public port
- app-private Docker Redis
- Supabase Postgres and Cloudflare R2 stay external
- frontend is deployed separately, for example on Vercel

## One-Time VPS Setup

Docker must be installed on the VPS. The deployment directory is:

```bash
/opt/video-downloader
```

Create the runtime env file on the VPS:

```bash
mkdir -p /opt/video-downloader
nano /opt/video-downloader/.env.vps
```

Use `.env.vps.example` as the template. Do not put real secrets in git.

Required production values:

- `FRONTEND_ORIGIN=https://downloads.mertonpharmacy.com`
- `DATABASE_URL`
- `REDIS_URL=redis://redis:6379`
- `R2_ENDPOINT`
- `R2_BUCKET`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `WORKER_CONCURRENCY=1`

## GitHub Secrets

Add these repository secrets:

- `VPS_HOST`: `31.97.197.59`
- `VPS_USER`: `root`
- `VPS_PORT`: `22`
- `VPS_SSH_KEY`: private key for a dedicated deploy key accepted by the VPS

Use an unencrypted deploy key for `VPS_SSH_KEY`; GitHub Actions cannot answer an
interactive SSH key passphrase prompt.

If the GHCR packages are private, add:

- `GHCR_PULL_USERNAME`: GitHub username with package read access
- `GHCR_PULL_TOKEN`: PAT with `read:packages`

If the GHCR packages are public, these two are not required.

Optional repository variable:

- `VPS_DEPLOY_PATH`: defaults to `/opt/video-downloader`

## Workflow

`.github/workflows/deploy-vps.yml` runs on pushes to `master` or `main`, and can
also be started manually.

The workflow:

1. runs backend tests
2. builds `api-runtime` and `worker-runtime`
3. pushes immutable SHA-tagged images to GHCR
4. copies `deploy/vps/docker-compose.yml` to the VPS
5. writes `.env.images` with the exact image tags
6. pulls images on the VPS
7. runs migrations
8. restarts API, worker, and Redis
9. checks `http://127.0.0.1:3100/system/health`

## nginx

nginx should proxy the public API domain to the local backend port:

```text
api-downloads.mertonpharmacy.com -> http://127.0.0.1:3100
```

`dev-api.mertonpharmacy.com` is preserved for the old API and should not be
reused by the video downloader.
