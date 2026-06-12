# Apartment Price Growth MVP Plan

## Goal

Build an internal MVP that compares apartment price growth by neighborhood and by apartment using KB price data during development. The production/commercial data source will later be replaced with MOLIT real transaction data through a provider interface.

## MVP Scope

- Initial regions: Bundang and Dongtan.
- Data source for MVP: KB internal web APIs, for private development only.
- Commercial-ready architecture: isolate data fetching behind a provider layer.
- Price metric: pyeong price from KB sale price.
- Default price field: `매매일반거래가`.
- Default area basis: supply area pyeong. Exclusive area pyeong can be added as an option.

## Core Features

### 1. Neighborhood Ranking And Graph

- Show each legal dong's aggregate apartment pyeong price growth.
- Provide ranking by growth rate.
- Provide a line chart where each neighborhood starts from the same baseline index of `100`.
- Allow checking how each neighborhood moved after the selected start month.

### 2. Apartment Ranking

- Show all apartments across selected regions in one ranking.
- Compare pyeong price from selected start month to latest available month.
- No graph required for this view.

## Period Controls

- Direct start month selector.
- Direct end month selector.
- Quick buttons:
  - 1 year ago
  - 2 years ago
  - 3 years ago
  - 5 years ago
  - 10 years ago
- Default end month: latest available KB price month.
- If an exact start month is missing, use the nearest later month.
- If an exact end month is missing, use the nearest earlier month.

## Architecture

```text
src/
  server.js
  worker.js
  providers/
    price-provider.js
    kb-price-provider.js
    molit-trade-provider.js
  services/
    price-calculator.js
    region-config.js
    cache-store.js
  public/
    index.html
    app.js
    styles.css
data/
  cache/
```

Docker deployment:

```text
web      - dashboard/API
worker   - slow KB price collector
postgres - persistent DB stored at /mnt/externalHdd/orulzip/postgres
```

## Provider Contract

```text
PriceDataProvider
- listRegions()
- listNeighborhoods(regionId)
- syncRegion(regionId)
- getMonthlyPrices(filters)
```

MVP implementation:

```text
KBPriceProvider
```

Future production implementation:

```text
MOLITTradeProvider
```

## Data Model

```text
regions
- id
- name

neighborhoods
- id
- region_id
- name
- legal_dong_code

apartments
- id
- source_complex_id
- name
- neighborhood_id
- address
- built_year
- household_count

apartment_area_types
- id
- apartment_id
- source_area_id
- supply_area_m2
- supply_area_pyeong
- exclusive_area_m2
- exclusive_area_pyeong

monthly_prices
- id
- apartment_area_type_id
- year_month
- sale_low
- sale_mid
- sale_high
- pyeong_price
- source
```

## Implementation Checklist

- [x] Project scaffold
- [x] Plan document
- [x] Region and legal dong config
- [x] KB provider shell
- [x] KB current price fetch
- [x] KB historical price fetch
- [x] Local JSON cache
- [x] Growth calculator
- [x] Neighborhood ranking API
- [x] Neighborhood chart API
- [x] Apartment ranking API
- [x] Static MVP UI
- [x] Period quick buttons
- [x] Local run verification

## Important Constraint

KB price data is only for internal MVP development. The KB page includes a no-unauthorized-use notice for KB price information. Do not use this KB data source for public or commercial service without permission from KB.

## KB Data Collection Policy

Collected:

- Complex id, name, legal dong code, neighborhood name, address
- Built year, household count, latitude, longitude
- Area type id, supply area, supply pyeong, exclusive area, exclusive pyeong
- Monthly KB sale low/mid/high prices
- Calculated monthly pyeong price

Not collected:

- Listing details
- Broker information
- Phone numbers
- Photos and floor plan images
- Ads and banners
- Login/user-specific data
- Favorites, community posts, comments
- Tracking logs
- Loan, consultation, and marketing payloads

Worker behavior:

- Requests are processed by a separate worker service.
- Crawl progress is persisted in Postgres.
- Default request delay is randomized between 15 and 60 seconds.
- Web restart does not erase collected data or crawl progress.

## Development Notes

- Keep all KB API paths and payload logic inside `src/providers/kb-price-provider.js`.
- Keep all ranking math inside `src/services/price-calculator.js`.
- The UI and API must not depend directly on KB field names.
- Cache source records with `source = "kb_internal_mvp"` so the future migration is explicit.
