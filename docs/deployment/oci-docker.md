# OCI Docker Deployment

This deployment runs the production split architecture on one Oracle Cloud VM:

- `frontend`: Next.js UI
- `backend-api`: Nest HTTP API
- `backend-worker`: BullMQ worker and cleanup scheduler
- `redis`: local Redis queue
- `caddy`: HTTPS reverse proxy

Postgres stays external, currently Supabase. Download artifacts stay in R2.

## 1. VM Shape

Use an Always Free eligible Ubuntu image on Ampere A1 if available. The stack is containerized and works on ARM64.

Open these ingress ports in the OCI security list or network security group:

- `22/tcp` for SSH from your IP
- `80/tcp` for HTTP certificate issuance and redirects
- `443/tcp` for HTTPS

Create an `A` record for your domain pointing at the VM public IP.

## 2. Install Docker

On the VM:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

. /etc/os-release
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
```

Log out and back in so the `docker` group is applied.

## 3. Prepare The App

```bash
sudo mkdir -p /opt/video-downloader
sudo chown "$USER":"$USER" /opt/video-downloader
git clone <repo-url> /opt/video-downloader
cd /opt/video-downloader
cp .env.production.example .env.production
```

Edit `.env.production`:

- `PUBLIC_DOMAIN` as the host without protocol, for example `downloads.example.com`
- `FRONTEND_ORIGIN=https://downloads.example.com`
- `DATABASE_URL=...`
- `R2_*` values
- keep `REDIS_URL=redis://redis:6379` unless using managed Redis
- keep `NEXT_PUBLIC_API_BASE_URL=/` for same-origin browser requests

## 4. Build, Migrate, Start

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml build

docker compose --env-file .env.production -f docker-compose.prod.yml \
  --profile migrate run --rm backend-migrate

docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

Check status:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f backend-api backend-worker
curl -fsS https://downloads.example.com/system/health
```

## 5. Enable Boot Restart

```bash
sudo cp deploy/systemd/video-downloader.service /etc/systemd/system/video-downloader.service
sudo systemctl daemon-reload
sudo systemctl enable video-downloader
sudo systemctl start video-downloader
```

## 6. Update Deployment

```bash
cd /opt/video-downloader
git pull

docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml \
  --profile migrate run --rm backend-migrate
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

## Routing

Caddy serves one public origin:

- `/` -> `frontend`
- `/system/*`, `/video/*`, `/download/*` -> `backend-api`

The frontend image is built with `NEXT_PUBLIC_API_BASE_URL=/`, so browser requests are same-origin and do not need cross-origin CORS in production.
