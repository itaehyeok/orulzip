# Development Deployment

`develop` 브랜치는 `dev.orulzip.com` 확인용 development 환경으로 배포한다.

## Server Layout

```text
/home/th/docker/custom/orulzip/
  production/    # main -> orulzip.com
  development/   # develop -> dev.orulzip.com
  workspace/
```

## Runtime Split

Production `.env`:

```env
CONTAINER_PREFIX=orulzip
WEB_PORT=3050
POSTGRES_DATA_DIR=/mnt/elements10tb/orulzip/postgres
```

Development `.env`:

```env
CONTAINER_PREFIX=orulzip-development
WEB_PORT=3051
POSTGRES_DATA_DIR=/mnt/elements10tb/orulzip-development/postgres
ORULZIP_ADMIN_COOKIE_SECURE=1
```

Use a separate `POSTGRES_PASSWORD` and `ORULZIP_ADMIN_SESSION_SECRET` for development.

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

- `main` pushes deploy to `/home/th/docker/custom/orulzip/production`
- `develop` pushes deploy to `/home/th/docker/custom/orulzip/development`

The development workflow expects the self-hosted runner label used by production:

```yaml
runs-on: [self-hosted, linux, orulzip-production]
```

If the runner labels are changed later, update both workflow files.
