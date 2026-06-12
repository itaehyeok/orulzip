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
- Current targets:
  - Seoul: 25 gu codes
  - Bundang: `41135`
  - Dongtan: queried through Hwaseong `41590`, filtered by Dongtan legal-dong names

Expected base request count for the current scope:

- `27` LAWD-code target groups x `126` months = `3,402` requests
- Some months may need additional pages if total rows exceed `numOfRows`.
- With the 10,000/day limit, the current scope should fit in one day.
- If the effective daily limit is lower, use `--limit` and rerun later; completed fetches are skipped.

## Commands

Plan only:

```sh
docker compose run --rm web npm run sync:molit -- --plan
```

Collect current target scope:

```sh
docker compose run --rm web npm run sync:molit -- --targets seoul,bundang,dongtan --limit 9000 --delay-ms 250
```

Resume behavior:

- Completed `(target_region_id, lawd_cd, year_month)` fetches are skipped.
- Failed fetches are retried on the next run.
- Use `--force` only when intentionally re-fetching completed months.

## Tables

- `molit_trade_deals`: raw and normalized MOLIT trade rows
- `molit_trade_fetches`: fetch status by target, LAWD code, and month

The source value for stored trade rows is `molit_apt_trade_detail`.
