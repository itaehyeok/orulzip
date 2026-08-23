# Development Deployment

`develop` 브랜치는 `dev.orulzip.com` 확인용 development 환경으로 배포한다.

## Server Layout

```text
/home/th/docker/custom/orulzip/
  database/        # production postgres
  data-collector/  # data collection and cache jobs
  production/      # main -> orulzip.com web
  development/     # develop -> isolated dev web + postgres
  workspace/
```

## Runtime Split

Database `.env`:

```env
CONTAINER_PREFIX=orulzip
POSTGRES_DATA_DIR=/mnt/elements10tb/orulzip/postgres
POSTGRES_PASSWORD=...
ORULZIP_DOCKER_NETWORK=orulzip-shared
```

Production web `.env`:

```env
CONTAINER_PREFIX=orulzip
WEB_PORT=3050
DATABASE_URL=postgres://orulzip_readonly:...@orulzip-postgres:5432/orulzip
ORULZIP_DB_INIT=0
ORULZIP_READ_ONLY=1
ORULZIP_ADMIN_COOKIE_SECURE=1
```

Development `.env`:

```env
CONTAINER_PREFIX=orulzip-development
WEB_PORT=3051
DEVELOPMENT_WEB_BIND_ADDRESS=192.168.0.6
ORULZIP_DEVELOPMENT_DOCKER_NETWORK=orulzip-development-private
DEVELOPMENT_POSTGRES_DATA_DIR=/mnt/elements10tb/orulzip/postgres-development
DEVELOPMENT_POSTGRES_PASSWORD=...
DEVELOPMENT_DB_READONLY_PASSWORD=...
DEVELOPMENT_DB_ANALYTICS_PASSWORD=...
DEVELOPMENT_ADMIN_SESSION_SECRET=...
DEVELOPMENT_ANALYTICS_HASH_SECRET=...
```

Data collector `.env`:

```env
CONTAINER_PREFIX=orulzip-data-collector
DATABASE_URL=postgres://orulzip_writer:...@orulzip-postgres:5432/orulzip
ORULZIP_DB_INIT=1
ORULZIP_READ_ONLY=0
MOLIT_DAILY_TARGETS=nationwide
MOLIT_DAILY_LIMIT=6500
MOLIT_DAILY_DELAY_MS=500
```

Development uses `docker-compose.development.yml`, a dedicated
`orulzip-development-postgres` container, a dedicated bind-mounted data directory,
and the internal-only `orulzip-development-private` network. It is never attached
to `orulzip-shared`.

The development database is a controlled snapshot of production with production
analytics rows excluded. Development web uses its own read-only role and its
analytics writes use a development-only writer. Telegram, MOLIT, and Naver server
secrets are disabled unless separately issued development credentials are added.
The development admin password is disabled by default; Hub OAuth is the public
access gate.

## Caddy

Caddy runs on `ssh th` under:

```text
/home/th/docker/third-party/caddy/Caddyfile
```

Add:

```caddyfile
dev.orulzip.com {
    # Import the shared Hub OAuth gate before proxying to Firebat.
    import hub_google_auth
    reverse_proxy 192.168.0.6:3051
}
```

The production Caddy configuration additionally removes OAuth cookies and identity
headers before proxying to development.

Reload Caddy after editing the Caddyfile.

## DNS

In Hostinger DNS, add `dev.orulzip.com` pointing to the same public target as `orulzip.com`.

## GitHub Actions

- `main` pushes deploy web-only compose to `/home/th/docker/custom/orulzip/production`
- `develop` pushes deploy `docker-compose.development.yml` to
  `/home/th/docker/custom/orulzip/development`
- `database` and `data-collector` are managed separately and are not restarted by web deployments.
- Development deploys do not run post-deploy MOLIT cache refresh. Refresh or
  replace the isolated development snapshot only when explicitly requested.

The development workflow expects the self-hosted runner label used by production:

```yaml
runs-on: [self-hosted, linux, orulzip-production]
```

If the runner labels are changed later, update both workflow files.
