import { query } from "./db.js";
import {
  MOLIT_DUPLICATE_DISTANCE_METERS,
  resolveMolitDuplicateGroups
} from "./molit-duplicate-resolver.js";

const REVIEW_DISTANCE_METERS = 250;

export async function syncMolitComplexes({
  geocode = false,
  geocodeMode = "missing",
  geocodeLimit = 0,
  overwriteGeocode = false
} = {}) {
  const upserted = await upsertMolitComplexesFromDeals();
  const matched = await matchMolitComplexesToKbApartments();
  await refreshMolitComplexActiveCoordinates();

  let geocodeResult = {
    enabled: false,
    skippedReason: geocode ? "NAVER_MAP_NCP_KEY_SECRET is not configured" : "geocoding disabled",
    attempted: 0,
    succeeded: 0,
    failed: 0,
    noResult: 0
  };

  if (geocode) {
    geocodeResult = await geocodeMolitComplexes({ geocodeMode, geocodeLimit, overwriteGeocode });
    await refreshMolitComplexActiveCoordinates();
  }

  return {
    syncedAt: new Date().toISOString(),
    upserted,
    matched,
    geocode: geocodeResult,
    overview: await readMolitComplexOverview()
  };
}

export async function readMolitComplexOverview() {
  const result = await query(`
    select
      count(*)::int as complexes,
      count(*) filter (where lat is not null and lng is not null)::int as with_coordinates,
      count(*) filter (where coord_source = 'naver_geocode')::int as naver_geocoded,
      count(*) filter (where coord_source = 'kb_match')::int as kb_matched_coordinates,
      count(*) filter (where matched_apartment_id is not null)::int as kb_matched,
      count(*) filter (where needs_review)::int as needs_review,
      count(*) filter (where coord_status = 'missing')::int as missing_coordinates,
      count(*) filter (where geocode_status = 'failed')::int as geocode_failed,
      count(*) filter (where geocode_status = 'no_result')::int as geocode_no_result
    from molit_complexes
  `);
  const row = result.rows[0] || {};
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value || 0)]));
}

export async function readMolitCoordinateAudit({ limit = 50 } = {}) {
  const [overview, rows] = await Promise.all([
    readMolitComplexOverview(),
    query(`
      select
        c.id,
        c.apt_name,
        c.legal_dong,
        c.jibun,
        c.address,
        c.coord_source,
        c.coord_status,
        c.geocode_status,
        c.match_method,
        c.match_score,
        c.distance_to_kb_m,
        c.needs_review,
        c.lat,
        c.lng,
        c.geocoded_lat,
        c.geocoded_lng,
        c.kb_lat,
        c.kb_lng,
        c.deal_count,
        c.first_month,
        c.last_month,
        a.name as kb_name,
        a.address as kb_address
      from molit_complexes c
      left join apartments a on a.id = c.matched_apartment_id
      where c.needs_review
         or c.distance_to_kb_m is not null
         or c.coord_status <> 'ready'
      order by
        c.needs_review desc,
        c.distance_to_kb_m desc nulls last,
        c.deal_count desc,
        c.apt_name asc
      limit $1
    `, [Math.max(1, Math.min(Number(limit) || 50, 500))])
  ]);

  return {
    overview,
    rows: rows.rows.map((row) => ({
      id: row.id,
      aptName: row.apt_name || "",
      legalDong: row.legal_dong || "",
      jibun: row.jibun || "",
      address: row.address || "",
      kbName: row.kb_name || "",
      kbAddress: row.kb_address || "",
      coordSource: row.coord_source || "",
      coordStatus: row.coord_status || "",
      geocodeStatus: row.geocode_status || "",
      matchMethod: row.match_method || "",
      matchScore: row.match_score === null ? null : Number(row.match_score),
      distanceToKbM: row.distance_to_kb_m === null ? null : Number(row.distance_to_kb_m),
      needsReview: Boolean(row.needs_review),
      lat: row.lat === null ? null : Number(row.lat),
      lng: row.lng === null ? null : Number(row.lng),
      geocodedLat: row.geocoded_lat === null ? null : Number(row.geocoded_lat),
      geocodedLng: row.geocoded_lng === null ? null : Number(row.geocoded_lng),
      kbLat: row.kb_lat === null ? null : Number(row.kb_lat),
      kbLng: row.kb_lng === null ? null : Number(row.kb_lng),
      dealCount: Number(row.deal_count || 0),
      firstMonth: row.first_month || "",
      lastMonth: row.last_month || ""
    }))
  };
}

export async function readMolitDuplicateAudit({ limit = 50 } = {}) {
  const result = await query(`
    select
      id,
      apt_name,
      lawd_cd,
      lawd_name,
      legal_dong,
      jibun,
      address,
      sido_code,
      sigungu_code,
      dong_key,
      build_year,
      deal_count,
      first_month,
      last_month,
      coord_source,
      coord_status,
      lat,
      lng
    from molit_complexes
    where lat is not null
      and lng is not null
      and coord_status = 'ready'
  `);
  const resolution = resolveMolitDuplicateGroups(result.rows.map((row) => ({
    id: row.id,
    name: row.apt_name || "",
    aptName: row.apt_name || "",
    lawdCd: row.lawd_cd || "",
    lawdName: row.lawd_name || "",
    legalDong: row.legal_dong || "",
    jibun: row.jibun || "",
    address: row.address || "",
    sidoCode: row.sido_code || "",
    sigunguCode: row.sigungu_code || "",
    dongKey: row.dong_key || "",
    buildYear: row.build_year === null ? null : Number(row.build_year),
    dealCount: Number(row.deal_count || 0),
    firstMonth: row.first_month || "",
    lastMonth: row.last_month || "",
    coordSource: row.coord_source || "",
    coordStatus: row.coord_status || "",
    lat: row.lat === null ? null : Number(row.lat),
    lng: row.lng === null ? null : Number(row.lng)
  })));
  const groups = resolution.groups
    .filter((group) => group.hiddenCount > 0)
    .slice(0, Math.max(1, Math.min(Number(limit) || 50, 500)));

  return {
    overview: {
      distanceMeters: MOLIT_DUPLICATE_DISTANCE_METERS,
      groupCount: resolution.groups.length,
      hiddenGroupCount: resolution.groups.filter((group) => group.hiddenCount > 0).length,
      hiddenComplexCount: resolution.hiddenIds.size
    },
    groups: groups.map((group) => ({
      id: group.id,
      label: group.label,
      activeId: group.activeId,
      hiddenCount: group.hiddenCount,
      distanceMeters: group.distanceMeters,
      items: group.items.map((item) => ({
        id: item.id,
        aptName: item.name,
        legalDong: item.legalDong,
        jibun: item.jibun,
        address: item.address,
        buildYear: item.buildYear,
        dealCount: item.dealCount,
        firstMonth: item.firstMonth,
        lastMonth: item.lastMonth,
        lat: item.lat,
        lng: item.lng,
        coordSource: item.coordSource,
        action: item.action,
        reason: item.reason
      }))
    }))
  };
}

async function upsertMolitComplexesFromDeals() {
  const result = await query(`
    with fetch_names as (
      select
        lawd_cd,
        case
          when lawd_cd = '41591' then '화성시 만세구'
          when lawd_cd = '41593' then '화성시 효행구'
          when lawd_cd = '41595' then '화성시 병점구'
          when lawd_cd = '41597' then '화성시 동탄구'
          when lawd_cd like '11%' then max(lawd_name)
          when lawd_cd like '41%' then regexp_replace(max(lawd_name), '\\s+[^\\s]*권$', '')
          else max(lawd_name)
        end as lawd_name
      from molit_trade_fetches
      group by lawd_cd
    ),
    trade_complexes as (
      select
        'molitc:' || md5(concat_ws('|',
          d.lawd_cd,
          coalesce(trim(d.legal_dong), ''),
          coalesce(trim(d.jibun), ''),
          regexp_replace(lower(coalesce(d.apt_name, '')), '[^0-9a-z가-힣]', '', 'g')
        )) as id,
        d.lawd_cd,
        coalesce(nullif(f.lawd_name, ''), d.lawd_cd) as lawd_name,
        coalesce(trim(d.legal_dong), '') as legal_dong,
        coalesce(trim(d.jibun), '') as jibun,
        coalesce(trim(d.apt_name), '') as apt_name,
        regexp_replace(lower(coalesce(d.apt_name, '')), '[^0-9a-z가-힣]', '', 'g') as normalized_apt_name,
        trim(concat_ws(' ', coalesce(nullif(f.lawd_name, ''), d.lawd_cd), nullif(trim(d.legal_dong), ''), nullif(trim(d.jibun), ''))) as address,
        left(d.lawd_cd, 2) as sido_code,
        case left(d.lawd_cd, 2)
          when '11' then '서울'
          when '26' then '부산'
          when '27' then '대구'
          when '28' then '인천'
          when '29' then '광주'
          when '30' then '대전'
          when '31' then '울산'
          when '36' then '세종'
          when '41' then '경기'
          when '42' then '강원'
          when '51' then '강원'
          when '43' then '충북'
          when '44' then '충남'
          when '45' then '전북'
          when '46' then '전남'
          when '47' then '경북'
          when '48' then '경남'
          when '50' then '제주'
          else left(d.lawd_cd, 2)
        end as sido_name,
        d.lawd_cd as sigungu_code,
        coalesce(nullif(f.lawd_name, ''), d.lawd_cd) as sigungu_name,
        concat_ws(':', d.lawd_cd, coalesce(trim(d.legal_dong), '')) as dong_key,
        coalesce(trim(d.legal_dong), '') as dong_name,
        string_agg(distinct d.target_region_id, ',' order by d.target_region_id) as target_region_ids,
        min(d.build_year) filter (where d.build_year is not null) as build_year,
        count(*)::int as deal_count,
        min(d.deal_year_month) as first_month,
        max(d.deal_year_month) as last_month
      from molit_trade_deals d
      left join fetch_names f on f.lawd_cd = d.lawd_cd
      where d.deal_amount is not null
        and d.pyeong_price is not null
        and d.exclusive_area_m2 is not null
        and coalesce(d.cancel_type, '') = ''
        and coalesce(trim(d.apt_name), '') <> ''
      group by d.lawd_cd, f.lawd_name, trim(d.legal_dong), trim(d.jibun), trim(d.apt_name),
               regexp_replace(lower(coalesce(d.apt_name, '')), '[^0-9a-z가-힣]', '', 'g')
    )
    insert into molit_complexes (
      id, lawd_cd, lawd_name, legal_dong, jibun, apt_name, normalized_apt_name, address,
      sido_code, sido_name, sigungu_code, sigungu_name, dong_key, dong_name,
      target_region_ids, build_year, deal_count, first_month, last_month, updated_at
    )
    select
      id, lawd_cd, lawd_name, legal_dong, jibun, apt_name, normalized_apt_name, address,
      sido_code, sido_name, sigungu_code, sigungu_name, dong_key, dong_name,
      target_region_ids, build_year, deal_count, first_month, last_month, now()
    from trade_complexes
    on conflict (id) do update set
      lawd_cd = excluded.lawd_cd,
      lawd_name = excluded.lawd_name,
      legal_dong = excluded.legal_dong,
      jibun = excluded.jibun,
      apt_name = excluded.apt_name,
      normalized_apt_name = excluded.normalized_apt_name,
      address = excluded.address,
      sido_code = excluded.sido_code,
      sido_name = excluded.sido_name,
      sigungu_code = excluded.sigungu_code,
      sigungu_name = excluded.sigungu_name,
      dong_key = excluded.dong_key,
      dong_name = excluded.dong_name,
      target_region_ids = excluded.target_region_ids,
      build_year = excluded.build_year,
      deal_count = excluded.deal_count,
      first_month = excluded.first_month,
      last_month = excluded.last_month,
      updated_at = now()
    returning id
  `);
  return result.rowCount;
}

async function matchMolitComplexesToKbApartments() {
  await query(`
    update molit_complexes
    set matched_apartment_id = null,
        match_method = null,
        match_score = null,
        kb_lat = null,
        kb_lng = null,
        updated_at = now()
  `);

  const result = await query(`
    with candidates as (
      select distinct on (c.id)
        c.id as complex_id,
        a.id as apartment_id,
        a.lat,
        a.lng,
        case
          when same_jibun and exact_name then 'jibun_exact_name'
          when same_jibun then 'jibun_similarity'
          when exact_name then 'exact_name'
          else 'name_similarity'
        end as match_method,
        case
          when same_jibun and exact_name then 1.0
          when same_jibun then 0.92 + least(name_similarity, 1) * 0.05
          when exact_name then 0.88
          else name_similarity
        end as match_score
      from molit_complexes c
      join lateral (
        select
          a.*,
          regexp_replace(lower(coalesce(a.name, '')), '[^0-9a-z가-힣]', '', 'g') = c.normalized_apt_name as exact_name,
          similarity(regexp_replace(lower(coalesce(a.name, '')), '[^0-9a-z가-힣]', '', 'g'), c.normalized_apt_name) as name_similarity,
          c.jibun <> ''
            and regexp_replace(coalesce(a.address, ''), '\\s+', '', 'g')
              like '%' || regexp_replace(concat(c.legal_dong, c.jibun), '\\s+', '', 'g') || '%' as same_jibun
        from apartments a
        where a.lat is not null
          and a.lng is not null
          and a.legal_dong_code like c.lawd_cd || '%'
          and (a.neighborhood_name = c.legal_dong or a.address like '%' || c.legal_dong || '%')
      ) a on true
      where
        (same_jibun and name_similarity >= 0.45)
        or exact_name
        or name_similarity >= 0.74
      order by c.id,
        match_score desc,
        same_jibun desc,
        exact_name desc,
        coalesce(a.household_count, 0) desc,
        a.name asc
    )
    update molit_complexes c
    set matched_apartment_id = candidates.apartment_id,
        match_method = candidates.match_method,
        match_score = round(candidates.match_score::numeric, 4),
        kb_lat = candidates.lat,
        kb_lng = candidates.lng,
        updated_at = now()
    from candidates
    where c.id = candidates.complex_id
    returning c.id
  `);
  return result.rowCount;
}

async function refreshMolitComplexActiveCoordinates() {
  await query(`
    update molit_complexes
    set lat = coalesce(geocoded_lat, kb_lat),
        lng = coalesce(geocoded_lng, kb_lng),
        coord_source = case
          when geocoded_lat is not null and geocoded_lng is not null then coalesce(geocode_provider, 'geocode')
          when kb_lat is not null and kb_lng is not null then 'kb_match'
          else null
        end,
        coord_status = case
          when coalesce(geocoded_lat, kb_lat) is not null and coalesce(geocoded_lng, kb_lng) is not null then 'ready'
          else 'missing'
        end,
        distance_to_kb_m = case
          when geocoded_lat is not null and geocoded_lng is not null and kb_lat is not null and kb_lng is not null
            then round(6371000 * acos(least(1, greatest(-1,
              cos(radians(kb_lat)) * cos(radians(geocoded_lat)) *
              cos(radians(geocoded_lng) - radians(kb_lng)) +
              sin(radians(kb_lat)) * sin(radians(geocoded_lat))
            ))))::int
          else null
        end,
        needs_review = case
          when geocoded_lat is not null and geocoded_lng is not null and kb_lat is not null and kb_lng is not null
            then round(6371000 * acos(least(1, greatest(-1,
              cos(radians(kb_lat)) * cos(radians(geocoded_lat)) *
              cos(radians(geocoded_lng) - radians(kb_lng)) +
              sin(radians(kb_lat)) * sin(radians(geocoded_lat))
            ))))::int >= $1
          else false
        end,
        updated_at = now()
  `, [REVIEW_DISTANCE_METERS]);
}

async function geocodeMolitComplexes({ geocodeMode, geocodeLimit, overwriteGeocode }) {
  const config = naverGeocodingConfig();
  if (!config.keyId || !config.keySecret) {
    return {
      enabled: false,
      skippedReason: "NAVER_MAP_NCP_KEY_SECRET is not configured",
      attempted: 0,
      succeeded: 0,
      failed: 0,
      noResult: 0
    };
  }

  const where = geocodeMode === "all"
    ? "true"
    : geocodeMode === "matched"
      ? "matched_apartment_id is not null"
      : "(lat is null or lng is null or coord_status <> 'ready')";
  const statusWhere = overwriteGeocode
    ? ""
    : "and geocoded_lat is null and geocoded_lng is null and geocode_status not in ('geocoded')";
  const limit = Math.max(0, Number(geocodeLimit || 0));
  const rows = await query(`
    select id, address, apt_name
    from molit_complexes
    where ${where}
      and coalesce(address, '') <> ''
      ${statusWhere}
    order by deal_count desc, last_month desc nulls last, apt_name asc
    ${limit > 0 ? `limit ${limit}` : ""}
  `);

  const result = {
    enabled: true,
    provider: "naver_geocode",
    attempted: 0,
    succeeded: 0,
    failed: 0,
    noResult: 0
  };

  for (const row of rows.rows) {
    result.attempted += 1;
    try {
      const geocoded = await geocodeNaverAddress(row.address, config);
      if (!geocoded) {
        result.noResult += 1;
        await markGeocodeNoResult(row.id, row.address);
        continue;
      }
      result.succeeded += 1;
      await markGeocodeSuccess(row.id, row.address, geocoded);
    } catch (error) {
      result.failed += 1;
      await markGeocodeFailed(row.id, row.address, error);
    }
  }

  return result;
}

async function geocodeNaverAddress(address, config) {
  const url = new URL("https://maps.apigw.ntruss.com/map-geocode/v2/geocode");
  url.searchParams.set("query", address);
  const response = await fetch(url, {
    headers: {
      "x-ncp-apigw-api-key-id": config.keyId,
      "x-ncp-apigw-api-key": config.keySecret,
      "accept": "application/json"
    }
  });
  if (!response.ok) {
    throw new Error(`Naver geocoding failed: HTTP ${response.status}`);
  }
  const payload = await response.json();
  const first = payload.addresses?.[0];
  if (!first?.x || !first?.y) return null;
  return {
    lat: Number(first.y),
    lng: Number(first.x),
    roadAddress: first.roadAddress || "",
    jibunAddress: first.jibunAddress || ""
  };
}

async function markGeocodeSuccess(id, queryText, geocoded) {
  await query(`
    update molit_complexes
    set geocoded_lat = $2,
        geocoded_lng = $3,
        geocode_provider = 'naver_geocode',
        geocode_status = 'geocoded',
        geocode_query = $4,
        geocode_error = null,
        geocoded_at = now(),
        updated_at = now()
    where id = $1
  `, [id, geocoded.lat, geocoded.lng, queryText]);
}

async function markGeocodeNoResult(id, queryText) {
  await query(`
    update molit_complexes
    set geocode_provider = 'naver_geocode',
        geocode_status = 'no_result',
        geocode_query = $2,
        geocode_error = null,
        updated_at = now()
    where id = $1
  `, [id, queryText]);
}

async function markGeocodeFailed(id, queryText, error) {
  await query(`
    update molit_complexes
    set geocode_provider = 'naver_geocode',
        geocode_status = 'failed',
        geocode_query = $2,
        geocode_error = $3,
        updated_at = now()
    where id = $1
  `, [id, queryText, error.message || String(error)]);
}

function naverGeocodingConfig() {
  return {
    keyId: process.env.NAVER_MAP_NCP_KEY_ID || "",
    keySecret: process.env.NAVER_MAP_NCP_KEY_SECRET || process.env.NAVER_MAP_NCP_CLIENT_SECRET || ""
  };
}
