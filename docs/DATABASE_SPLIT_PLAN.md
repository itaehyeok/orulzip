# Database Split Plan

Last reviewed: 2026-06-23

This document records the database split direction and the current state after
the first development database clone.

## Current State

Production and development use the same PostgreSQL container but separate
databases:

```text
orulzip-postgres:5432/orulzip      # production
orulzip-postgres:5432/orulzip_dev  # development snapshot
```

Current runtime responsibilities:

- Production web reads `orulzip`.
- Development web reads `orulzip_dev`.
- Production analytics writes to `orulzip`.
- Development analytics writes to `orulzip_dev`.
- Data collector containers write to the same `orulzip` database.
- Web containers run with `ORULZIP_DB_INIT=0` and `ORULZIP_READ_ONLY=1`.
- Data collector containers run with `ORULZIP_DB_INIT=1` and
  `ORULZIP_READ_ONLY=0`.

This removes the immediate production risk from development schema experiments.
Daily MOLIT collection still writes only to production.

Observed size before the split on 2026-06-23:

- Database `orulzip`: about 10 GB
- PostgreSQL data directory: about 11 GB
- Largest table: `public.molit_trade_deals`, about 8.5 GB and about 5.6M rows
- Other large derived tables:
  - `public.map_dong_apartment_rank_items`: about 574 MB
  - `public.map_growth_items`: about 505 MB
  - `public.price_band_rank_items`: about 381 MB
  - `public.monthly_prices`: about 247 MB

Observed size after the first clone on 2026-06-23:

- Database `orulzip`: about 10 GB
- Database `orulzip_dev`: about 7.1 GB
- PostgreSQL data directory: about 19 GB
- Clone dump file: `/mnt/elements10tb/orulzip/db-backups/orulzip_to_orulzip_dev_20260623_103303.dump`
- Dump file size: about 670 MB

`orulzip_dev` is smaller than the original because dump/restore rebuilt tables
and indexes in a compact form.

## Completed First Split

The first step was a full development database clone.

```text
orulzip      # production database, current source of truth
orulzip_dev  # cloned development database snapshot
```

Implemented state:

- Production web keeps using `orulzip`.
- Data collectors keep writing only to `orulzip`.
- Development web uses `orulzip_dev`.
- Development analytics uses `orulzip_dev`.
- Development web uses `orulzip_dev_readonly`.
- Development analytics uses `orulzip_dev_analytics_writer`.
- `orulzip_dev` is a snapshot copy of production from clone time.

Important rule:

```text
Daily collection: orulzip only
Development refresh: manual prod -> dev clone/refresh only when requested
```

Do not run daily duplicate collection into both databases.

Recommended operational rule after the first split:

- Treat `orulzip` as the production source of truth.
- Treat `orulzip_dev` as disposable development data.
- Keep daily MOLIT collection writing only to `orulzip`.
- Refresh `orulzip_dev` from `orulzip` manually or on a controlled schedule when
  fresh data is needed.
- Do not run daily duplicate collection into both databases.

## First Split Implementation Checklist

Completed on 2026-06-23:

1. Created a `pg_dump -Fc --no-owner --no-acl` dump of `orulzip`.
2. Restored it into `orulzip_dev`.
3. Created development-only roles for `orulzip_dev`.
4. Updated `/home/th/docker/custom/orulzip/development/.env` so development web
   points at `orulzip_dev`.
5. Kept `/home/th/docker/custom/orulzip/production/.env` pointing at `orulzip`.
6. Kept `/home/th/docker/custom/orulzip/data-collector/.env` pointing at
   `orulzip`.
7. Restarted only the development web after changing its `.env`.
8. Verified `dev.orulzip.com` reads from `orulzip_dev`.
9. Verified `orulzip.com` still reads from `orulzip`.
10. Verified data collector containers still write to `orulzip`.

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

Completed first step:

```text
Full clone: orulzip -> orulzip_dev
```

Current next step:

```text
Keep daily collection on orulzip only.
Refresh orulzip_dev from orulzip only when explicitly requested.
```

Later target:

```text
Shared raw database + separate production/development derived databases
```

The full clone removed the immediate production risk. Do the raw/app split later
when there is time to refactor the data access boundary cleanly.
