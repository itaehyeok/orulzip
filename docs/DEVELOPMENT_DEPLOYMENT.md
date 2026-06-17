# Development Deployment

`develop` 브랜치는 `dev.orulzip.com` 확인용 development 환경으로 배포한다.

## Server Layout

```text
/home/th/docker/custom/orulzip/
  database/        # shared postgres
  data-collector/  # data collection and cache jobs
  production/      # main -> orulzip.com web
  development/     # develop -> dev.orulzip.com web
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

Development web `.env`:

```env
CONTAINER_PREFIX=orulzip-development
WEB_PORT=3051
DATABASE_URL=postgres://orulzip_readonly:...@orulzip-postgres:5432/orulzip
ORULZIP_DB_INIT=0
ORULZIP_READ_ONLY=1
ORULZIP_ADMIN_COOKIE_SECURE=1
```

Data collector `.env`:

```env
CONTAINER_PREFIX=orulzip-data-collector
DATABASE_URL=postgres://orulzip_writer:...@orulzip-postgres:5432/orulzip
ORULZIP_DB_INIT=1
ORULZIP_READ_ONLY=0
MOLIT_DAILY_TARGETS=seoul,gyeonggi,incheon
```

Use a separate `ORULZIP_ADMIN_SESSION_SECRET` for development. Web containers should use the read-only database account; data collector containers should use the writer account.

## Caddy

Caddy runs on `ssh th` under:

```text
/home/th/docker/third-party/caddy/Caddyfile
```

Add:

```caddyfile
dev.orulzip.com {
    reverse_proxy 192.168.0.6:3051
}
```

Reload Caddy after editing the Caddyfile.

## DNS

In Hostinger DNS, add `dev.orulzip.com` pointing to the same public target as `orulzip.com`.

## GitHub Actions

- `main` pushes deploy web-only compose to `/home/th/docker/custom/orulzip/production`
- `develop` pushes deploy web-only compose to `/home/th/docker/custom/orulzip/development`
- `database` and `data-collector` are managed separately and are not restarted by web deployments.

The development workflow expects the self-hosted runner label used by production:

```yaml
runs-on: [self-hosted, linux, orulzip-production]
```

If the runner labels are changed later, update both workflow files.
