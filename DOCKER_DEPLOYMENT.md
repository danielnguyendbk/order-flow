# Order Flow container deployment

The release consists of three project images plus the official Redis image:

- `order-flow-backend`: API, Telegram Bot, notification worker, and database initializer.
- `order-flow-frontend`: production Next.js standalone server.
- `order-flow-postgres`: PostgreSQL 16 with the baseline Order Flow schema embedded.
- `redis:7-alpine`: BullMQ storage for Telegram notifications.

The same backend image is started with different commands for the API, Bot, worker, and one-shot database initialization job. Images are published for both `linux/amd64` and `linux/arm64`.

## Run the published release

The target machine only needs Docker Engine with Docker Compose. Copy `compose.yaml` and `.env.docker.example` into an empty directory, then:

```bash
cp .env.docker.example .env.docker
# Edit every replace-with-* value in .env.docker.
docker compose --env-file .env.docker pull
docker compose --env-file .env.docker up -d
docker compose --env-file .env.docker ps
```

Set `ORDER_FLOW_VERSION` to the immutable release tag being deployed; `latest` is intentionally not accepted. Open the Admin Web at `http://localhost:3000`. The API health endpoint is `http://localhost:3001/health`. Ports can be changed with `WEB_PORT`, `API_PORT`, and `BOT_WEBHOOK_PORT`; Compose binds them to loopback, so expose them only through a TLS reverse proxy.

`db-init` is expected to finish with exit code 0. It creates or refreshes only the configured OWNER login. PostgreSQL initializes the schema only when its named volume is empty. Normal restarts preserve data in `postgres_data` and Redis state in `redis_data`.

Useful operations:

```bash
docker compose --env-file .env.docker logs -f api web telegram-bot notification-worker
docker compose --env-file .env.docker pull
docker compose --env-file .env.docker up -d
docker compose --env-file .env.docker down
```

`docker compose down` keeps data. `docker compose down -v` permanently deletes the PostgreSQL and Redis volumes and must only be used when a clean database is intended.

Telegram uses long polling when `TELEGRAM_WEBHOOK_DOMAIN` is empty. For webhook mode, put a TLS reverse proxy in front of port 3002 of the `telegram-bot` service and set the three webhook variables. In production, terminate HTTPS at that proxy and set `TRUST_PROXY=true` only when it is the sole path to the API.

## Publish images to GHCR

The workflow `.github/workflows/publish-containers.yml` publishes all three images when a version tag is pushed:

```bash
git tag v1.0.0
git push origin v1.0.0
```

It creates `v1.0.0`, commit-SHA, and `latest` tags under. Deploy the immutable `v1.0.0` or commit-SHA tag, never `latest`:

```text
ghcr.io/danielnguyendbk/order-flow-backend
ghcr.io/danielnguyendbk/order-flow-frontend
ghcr.io/danielnguyendbk/order-flow-postgres
```

Set the three GHCR packages to **Public** if recipients should pull without authenticating. For private packages, recipients must run `docker login ghcr.io` with a token that has `read:packages` access.

To publish under another account or registry, build/push equivalent image names and change `ORDER_FLOW_IMAGE_PREFIX` in `.env.docker`.

## Build and test locally

```bash
docker build -t order-flow-backend:local backend
docker build -t order-flow-frontend:local frontend
docker build -f backend/Dockerfile.postgres -t order-flow-postgres:local backend
```

Use this local image prefix before running Compose:

```dotenv
ORDER_FLOW_IMAGE_PREFIX=order-flow
ORDER_FLOW_VERSION=local
```

For a release smoke test, verify that `db-init` exits successfully, all five long-running services are healthy/running, the OWNER can sign in, and the Bot can answer `/start`.
