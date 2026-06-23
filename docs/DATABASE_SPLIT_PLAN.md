# Database Split Plan

Last reviewed: 2026-06-23

This document records the intended database split direction before any database
migration work starts.

## Current State

Production and development currently point at the same PostgreSQL container and
the same database:

```text
orulzip-postgres:5432/orulzip
```

Current runtime responsibilities:

- Production web reads `orulzip`.
- Development web also reads `orulzip`.
- Production and development analytics both write to the same `orulzip`
  database.
- Data collector containers write to the same `orulzip` database.
- Web containers run with `ORULZIP_DB_INIT=0` and `ORULZIP_READ_ONLY=1`.
- Data collector containers run with `ORULZIP_DB_INIT=1` and
  `ORULZIP_READ_ONLY=0`.

This means a schema change tested through development can affect production if
it runs against the shared database.

Observed size on 2026-06-23:

- Database `orulzip`: about 10 GB
- PostgreSQL data directory: about 11 GB
- Largest table: `public.molit_trade_deals`, about 8.5 GB and about 5.6M rows
- Other large derived tables:
  - `public.map_dong_apartment_rank_items`: about 574 MB
  - `public.map_growth_items`: about 505 MB
  - `public.price_band_rank_items`: about 381 MB
  - `public.monthly_prices`: about 247 MB

## Immediate Plan

The first step should be a full development database clone.

```text
orulzip      # production database, current source of truth
orulzip_dev  # cloned development database
```

Do not attempt a raw-only split in this first step. The current application uses
one `DATABASE_URL` for raw trade data, cache tables, ranking tables, analytics,
and operational tables. Separating only raw tables first would require a larger
application refactor before it is safe.

Immediate target state:

- Production web keeps using `orulzip`.
- Data collectors keep writing only to `orulzip`.
- Development web uses `orulzip_dev`.
- Development analytics uses `orulzip_dev`.
- Development cache/ranking refresh jobs, if run, use `orulzip_dev`.
- `orulzip_dev` is a snapshot copy of production at clone time.

Expected impact:

- Disk usage increases by roughly another 10-11 GB for the cloned database.
- A dump/restore workflow can temporarily need additional dump-file space.
- Production schema changes and development schema changes become isolated.
- Development data stops being automatically current unless it is refreshed from
  production or collected separately.

Recommended operational rule after the first split:

- Treat `orulzip` as the production source of truth.
- Treat `orulzip_dev` as disposable development data.
- Keep daily MOLIT collection writing only to `orulzip`.
- Refresh `orulzip_dev` from `orulzip` manually or on a controlled schedule when
  fresh data is needed.
- Do not run daily duplicate collection into both databases.

## First Split Checklist

When implementing the immediate split, the next worker should:

1. Create a database backup or dump of `orulzip`.
2. Restore it into a new database such as `orulzip_dev`.
3. Create or adjust development-only roles for `orulzip_dev`.
4. Update `/home/th/docker/custom/orulzip/development/.env` so development web
   points at `orulzip_dev`.
5. Keep `/home/th/docker/custom/orulzip/production/.env` pointing at `orulzip`.
6. Keep `/home/th/docker/custom/orulzip/data-collector/.env` pointing at
   `orulzip`.
7. Restart only the development web after changing its `.env`.
8. Verify `dev.orulzip.com` reads from `orulzip_dev`.
9. Verify `orulzip.com` still reads from `orulzip`.
10. Verify data collector containers still write to `orulzip`.

## Future Target Architecture

The long-term design should separate raw source data from environment-specific
derived data.

```text
Raw database
  - MOLIT raw trade rows
  - MOLIT complexes
  - fetch status and collection history

Production database
  - production cache tables
  - production ranking tables
  - production analytics
  - production app-specific tables

Development database
  - development cache tables
  - development ranking tables
  - development analytics
  - experimental schema changes
```

Application connections in the final architecture:

```text
RAW_DATABASE_URL  # shared read source for raw trade data
DATABASE_URL      # environment-specific app/cache/ranking database
```

In that model:

- Data collectors write only to the raw database.
- Production reads raw data and writes production caches/rankings.
- Development reads the same raw data and writes development caches/rankings.
- Development schema experiments cannot modify production caches/rankings or raw
  source data.
- Raw trade data is stored once instead of duplicated per environment.

## Future Refactor Notes

The raw/app split is not just an infrastructure change. It likely requires code
changes because many current queries assume source data and derived tables live
behind the same `DATABASE_URL`.

Before implementing the final architecture, inspect and refactor:

- `src/services/db.js`
- `src/services/map-growth-cache.js`
- `src/services/price-band-rank-cache.js`
- `src/providers/molit-trade-provider.js`
- `scripts/sync-molit-trades.js`
- `scripts/refresh-molit-map-cache.js`
- `scripts/refresh-price-band-cache.js`
- `docker-compose.web.yml`
- `docker-compose.data-collector.yml`
- deployment `.env` files

The final refactor should introduce explicit raw-data access helpers instead of
allowing arbitrary code to mix raw and environment-specific writes.

## Decision Summary

Current next step:

```text
Full clone: orulzip -> orulzip_dev
```

Later target:

```text
Shared raw database + separate production/development derived databases
```

Do the full clone first to remove the immediate production risk. Do the raw/app
split later when there is time to refactor the data access boundary cleanly.
