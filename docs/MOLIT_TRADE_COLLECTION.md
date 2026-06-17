# MOLIT Trade Collection

This document tracks the public apartment trade data collection setup. Keep this data separate from KB price data.

## API

- Provider: 공공데이터포털 / 국토교통부
- API: 국토교통부_아파트 매매 실거래가 상세 자료
- Detail function: 아파트 매매 실거래가 공개 자료(상세)
- Endpoint: `/getRTMSDataSvcAptTradeDev`
- Daily traffic limit: 10,000 requests/day
- Data format: XML
- Required key: `MOLIT_APT_TRADE_SERVICE_KEY`

## Current Collection Scope

- Data is stored only in `molit_` tables.
- KB tables such as `monthly_prices`, `apartments`, and `area_types` must not receive MOLIT trade rows.
- Default period follows the current KB data period:
  - `201601` through `202606` as of 2026-06-12.
- Current coded targets:
  - Nationwide: 254 current 시군구-level LAWD codes from 행정표준코드관리시스템 법정동코드 전체자료, downloaded 2026-06-17
  - Seoul: 25 gu codes
  - Gyeonggi: 시군구 codes currently listed in `scripts/sync-molit-trades.js`
  - Incheon: 10 gu/gun codes
  - Bundang: `41135`
  - Dongtan: `41597`, filtered by Dongtan legal-dong names

Expected base request count for the current coded scope:

- Seoul + Gyeonggi + Incheon is roughly 83 LAWD-code groups x 126 months = about 10,458 base requests.
- Some months may need additional pages if total rows exceed `numOfRows`.
- With the 10,000/day limit, use `--limit 8000` to leave room for multi-page responses, retries, and operational checks.
- Completed fetches are skipped, so running the same command daily resumes from remaining work.

## Nationwide Collection Plan

Nationwide collection uses the single source target `nationwide`, so new and refreshed transaction rows are normalized under one `target_region_id`.

Recommended daily budget:

- 8,000 requests/day for historical backfill.
- 1,000 requests/day reserved for failed fetch retries and recent-month refreshes.
- 1,000 requests/day left unused as a buffer for extra pages and provider throttling.

Expected duration after a nationwide LAWD-code master is added:

- 254 LAWD-code groups x 126 months = about 32,004 base requests.
- Some dense regions/months require additional pages.
- At a 6,500 task/day budget, expect about 5 days for the initial nationwide backfill.
- After backfill, refresh only the latest 3 months daily or weekly.

Operational rule:

- The daily collection should run automatically with a fixed `--limit`.
- Do not require manual daily prompts; completed `(target_region_id, lawd_cd, year_month)` fetches are skipped.
- Failed rows should remain marked as `failed` and be retried in a later run.
- `molit-daily-collector` runs the current coded scope once, then sleeps for 24 hours before resuming.

## Commands

Plan only:

```sh
docker compose run --rm web npm run sync:molit -- --plan
```

Collect current target scope:

```sh
docker compose run --rm web npm run sync:molit -- --targets seoul,bundang,dongtan --limit 9000 --delay-ms 250
```

Collect nationwide scope within the safe daily budget:

```sh
docker compose run --rm molit-daily-collector npm run sync:molit -- --targets nationwide --limit 6500 --delay-ms 500
```

Start the automatic daily collector:

```sh
cd /home/th/docker/custom/orulzip/data-collector
COMPOSE_FILE=docker-compose.data-collector.yml docker compose -p orulzip-data-collector up -d --build molit-daily-collector
```

Follow logs:

```sh
docker logs -f orulzip-data-collector-molit-daily-collector
```

Resume behavior:

- Completed `(target_region_id, lawd_cd, year_month)` fetches are skipped.
- Failed fetches are retried on the next run.
- Use `--force` only when intentionally re-fetching completed months.

## Tables

- `molit_trade_deals`: raw and normalized MOLIT trade rows
- `molit_trade_fetches`: fetch status by target, LAWD code, and month

The source value for stored trade rows is `molit_apt_trade_detail`.
