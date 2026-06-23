import { query, withClient } from "./db.js";

const REB_APT_IDENTITY_URL = "https://api.odcloud.kr/api/AptIdInfoSvc/v1/getAptInfo";
const DEFAULT_PER_PAGE = 1000;
const DEFAULT_MATCH_SCORE = 90;
const INSERT_CHUNK_SIZE = 500;

export function rebApartmentIdentityServiceKey(env = process.env) {
  return String(env.REB_APT_IDENTITY_SERVICE_KEY || env.DATA_GO_KR_SERVICE_KEY || "").trim();
}

export async function syncRebApartmentIdentityIfConfigured(options = {}) {
  const serviceKey = options.serviceKey || rebApartmentIdentityServiceKey();
  if (!serviceKey) {
    return {
      enabled: false,
      skipped: true,
      reason: "REB_APT_IDENTITY_SERVICE_KEY is not configured"
    };
  }

  const result = await syncRebApartmentIdentity({ ...options, serviceKey });
  return {
    enabled: true,
    skipped: false,
    ...result
  };
}

export async function syncRebApartmentIdentity({
  serviceKey = rebApartmentIdentityServiceKey(),
  perPage = DEFAULT_PER_PAGE,
  maxPages = 0,
  deleteStale = true,
  refreshMatches = true,
  delayMs = 0
} = {}) {
  const normalizedServiceKey = normalizePublicDataServiceKey(serviceKey);
  if (!normalizedServiceKey) {
    throw new Error("REB_APT_IDENTITY_SERVICE_KEY or DATA_GO_KR_SERVICE_KEY is required");
  }

  const normalizedPerPage = Math.max(1, Math.min(Number(perPage) || DEFAULT_PER_PAGE, DEFAULT_PER_PAGE));
  const pageLimit = Math.max(0, Number(maxPages) || 0);
  const importedAt = new Date();
  const stats = {
    fetchedRows: 0,
    upsertedRows: 0,
    pageCount: 0,
    totalCount: null,
    partial: false
  };

  let page = 1;
  let totalPages = Number.POSITIVE_INFINITY;
  while (page <= totalPages) {
    if (pageLimit > 0 && page > pageLimit) {
      stats.partial = true;
      break;
    }

    const pageResult = await fetchRebAptIdentityPage({
      serviceKey: normalizedServiceKey,
      page,
      perPage: normalizedPerPage
    });
    if (Number.isFinite(pageResult.totalCount)) {
      stats.totalCount = pageResult.totalCount;
      totalPages = Math.max(1, Math.ceil(pageResult.totalCount / normalizedPerPage));
    }
    if (!pageResult.rows.length) break;

    stats.fetchedRows += pageResult.rows.length;
    stats.upsertedRows += await upsertRebAptIdentityRows(pageResult.rows, importedAt);
    stats.pageCount = page;

    page += 1;
    if (delayMs > 0 && page <= totalPages) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  if (!stats.partial && stats.fetchedRows === 0) {
    throw new Error("REB apartment identity API returned no rows");
  }

  let deletedStaleRows = 0;
  if (deleteStale && !stats.partial) {
    deletedStaleRows = await deleteStaleRebAptIdentityRows(importedAt);
  }

  const matchResult = refreshMatches && !stats.partial
    ? await refreshRebApartmentIdentityMatches()
    : {
      skipped: true,
      reason: stats.partial ? "Partial sync does not refresh matches" : "Match refresh disabled"
    };

  return {
    syncedAt: new Date().toISOString(),
    ...stats,
    deletedStaleRows,
    matches: matchResult,
    coverage: await readRebApartmentHouseholdCoverage()
  };
}

export async function refreshRebApartmentIdentityMatches({
  minMatchScore = DEFAULT_MATCH_SCORE,
  skipIfEmpty = false
} = {}) {
  return withClient(async (client) => {
    await client.query("begin");
    try {
      const rawCountResult = await client.query("select count(*)::int as count from reb_apt_identity_raw");
      const rawCount = Number(rawCountResult.rows[0]?.count || 0);
      if (skipIfEmpty && rawCount === 0) {
        await client.query("commit");
        return {
          skipped: true,
          reason: "REB apartment identity raw table is empty",
          rawCount
        };
      }

      await refreshRebApartmentIdentityNormalizedTable(client);

      const resetResult = await client.query(`
        update molit_complexes
        set reb_complex_pk = null,
            reb_household_count = null,
            reb_dong_count = null,
            reb_match_score = null,
            reb_match_source = null,
            reb_matched_at = null,
            updated_at = now()
        where reb_complex_pk is not null
           or reb_household_count is not null
           or reb_dong_count is not null
           or reb_match_score is not null
           or reb_match_source is not null
           or reb_matched_at is not null
      `);

      const matchResult = await client.query(`
        with molit as (
          select
            id,
            lawd_cd,
            normalized_apt_name,
            regexp_replace(lower(concat(coalesce(legal_dong, ''), coalesce(jibun, ''))), '[^0-9a-z가-힣]', '', 'g') as address_key
          from molit_complexes
          where coalesce(legal_dong, '') <> ''
            and coalesce(jibun, '') <> ''
            and coalesce(normalized_apt_name, '') <> ''
        ),
        direct_candidates as (
          select
            m.id as complex_id,
            r.complex_pk as reb_complex_pk,
            r.unit_cnt,
            r.dong_cnt,
            score.name_match_score,
            'lawd_address_name'::text as match_source,
            1 as match_priority
          from molit m
          join reb_apt_identity_apartment_norm r
            on r.lawd_cd = m.lawd_cd
           and r.adres_norm like '%' || m.address_key || '%'
          join lateral (
            select greatest(
              reb_identity_name_score(r.complex_nm1_norm, m.normalized_apt_name),
              reb_identity_name_score(r.complex_nm2_norm, m.normalized_apt_name),
              reb_identity_name_score(r.complex_nm3_norm, m.normalized_apt_name)
            )::int as name_match_score
          ) score on true
          where m.address_key <> ''
        ),
        direct_strong as (
          select distinct complex_id
          from direct_candidates
          where name_match_score >= $1
        ),
        fallback_candidates as (
          select
            m.id as complex_id,
            r.complex_pk as reb_complex_pk,
            r.unit_cnt,
            r.dong_cnt,
            score.name_match_score,
            'sido_address_name'::text as match_source,
            2 as match_priority
          from molit m
          join reb_apt_identity_apartment_norm r
            on left(r.lawd_cd, 2) = left(m.lawd_cd, 2)
           and r.adres_norm like '%' || m.address_key || '%'
          join lateral (
            select greatest(
              reb_identity_name_score(r.complex_nm1_norm, m.normalized_apt_name),
              reb_identity_name_score(r.complex_nm2_norm, m.normalized_apt_name),
              reb_identity_name_score(r.complex_nm3_norm, m.normalized_apt_name)
            )::int as name_match_score
          ) score on true
          where m.address_key <> ''
            and not exists (
              select 1
              from direct_strong ds
              where ds.complex_id = m.id
            )
        ),
        candidates as (
          select * from direct_candidates where name_match_score >= $1
          union all
          select * from fallback_candidates where name_match_score >= $1
        ),
        selected as (
          select distinct on (complex_id)
            complex_id,
            reb_complex_pk,
            unit_cnt,
            dong_cnt,
            name_match_score,
            match_source
          from candidates
          order by complex_id,
                   name_match_score desc,
                   match_priority asc,
                   coalesce(unit_cnt, 0) desc,
                   reb_complex_pk asc
        )
        update molit_complexes c
        set reb_complex_pk = selected.reb_complex_pk,
            reb_household_count = selected.unit_cnt,
            reb_dong_count = selected.dong_cnt,
            reb_match_score = selected.name_match_score,
            reb_match_source = selected.match_source,
            reb_matched_at = now(),
            updated_at = now()
        from selected
        where c.id = selected.complex_id
        returning c.id
      `, [Math.max(0, Number(minMatchScore) || DEFAULT_MATCH_SCORE)]);

      const normalizedCountResult = await client.query("select count(*)::int as count from reb_apt_identity_apartment_norm");
      await client.query("commit");

      return {
        skipped: false,
        rawCount,
        normalizedApartmentCount: Number(normalizedCountResult.rows[0]?.count || 0),
        resetRows: resetResult.rowCount,
        matchedRows: matchResult.rowCount,
        minMatchScore: Math.max(0, Number(minMatchScore) || DEFAULT_MATCH_SCORE)
      };
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}

export async function readRebApartmentHouseholdCoverage() {
  const result = await query(`
    select
      (select count(*)::int from reb_apt_identity_raw) as raw_rows,
      (select count(*)::int from reb_apt_identity_apartment_norm) as reb_apartment_rows,
      (select count(*)::int from reb_apt_identity_apartment_norm where unit_cnt >= 100) as reb_apartment_100_rows,
      count(*)::int as molit_complexes,
      count(*) filter (where reb_complex_pk is not null)::int as molit_reb_matched,
      count(*) filter (where reb_household_count >= 100)::int as molit_reb_100,
      count(*) filter (where reb_household_count >= 100 and lat is not null and lng is not null)::int as molit_reb_100_with_coordinates,
      count(*) filter (where left(coalesce(lawd_cd, ''), 2) not in ('11', '41'))::int as molit_non_capital_complexes,
      count(*) filter (where left(coalesce(lawd_cd, ''), 2) not in ('11', '41') and reb_complex_pk is not null)::int as molit_non_capital_reb_matched,
      count(*) filter (where left(coalesce(lawd_cd, ''), 2) not in ('11', '41') and reb_household_count >= 100)::int as molit_non_capital_reb_100,
      count(*) filter (where left(coalesce(lawd_cd, ''), 2) not in ('11', '41') and reb_household_count >= 100 and lat is not null and lng is not null)::int as molit_non_capital_reb_100_with_coordinates
    from molit_complexes
  `);
  const row = result.rows[0] || {};
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value || 0)]));
}

async function fetchRebAptIdentityPage({ serviceKey, page, perPage }) {
  const url = new URL(REB_APT_IDENTITY_URL);
  url.searchParams.set("page", String(page));
  url.searchParams.set("perPage", String(perPage));
  url.searchParams.set("returnType", "JSON");
  url.searchParams.set("serviceKey", serviceKey);

  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`REB apartment identity API failed: HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload.data)) {
    throw new Error("REB apartment identity API returned an unexpected payload");
  }

  return {
    totalCount: Number(payload.totalCount),
    rows: payload.data
  };
}

async function upsertRebAptIdentityRows(rows, importedAt) {
  let upsertedRows = 0;
  for (let start = 0; start < rows.length; start += INSERT_CHUNK_SIZE) {
    const chunk = rows.slice(start, start + INSERT_CHUNK_SIZE)
      .map(normalizeRebAptIdentityRow)
      .filter((row) => row.complexPk);
    if (!chunk.length) continue;

    const params = [];
    const values = chunk.map((row, index) => {
      const offset = index * 11;
      params.push(
        row.complexPk,
        row.pnu,
        row.adres,
        row.complexNm1,
        row.complexNm2,
        row.complexNm3,
        row.complexGbCd,
        row.dongCnt,
        row.unitCnt,
        row.useaprDt,
        importedAt
      );
      return `(
        $${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5},
        $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}
      )`;
    });

    const result = await query(`
      insert into reb_apt_identity_raw (
        complex_pk, pnu, adres, complex_nm1, complex_nm2, complex_nm3,
        complex_gb_cd, dong_cnt, unit_cnt, useapr_dt, imported_at
      ) values ${values.join(",")}
      on conflict (complex_pk) do update set
        pnu = excluded.pnu,
        adres = excluded.adres,
        complex_nm1 = excluded.complex_nm1,
        complex_nm2 = excluded.complex_nm2,
        complex_nm3 = excluded.complex_nm3,
        complex_gb_cd = excluded.complex_gb_cd,
        dong_cnt = excluded.dong_cnt,
        unit_cnt = excluded.unit_cnt,
        useapr_dt = excluded.useapr_dt,
        imported_at = excluded.imported_at
    `, params);
    upsertedRows += result.rowCount;
  }
  return upsertedRows;
}

async function deleteStaleRebAptIdentityRows(importedAt) {
  const result = await query("delete from reb_apt_identity_raw where imported_at < $1", [importedAt]);
  return result.rowCount;
}

async function refreshRebApartmentIdentityNormalizedTable(client) {
  await client.query("truncate reb_apt_identity_apartment_norm");
  await client.query(`
    create or replace function reb_identity_name_score(left_name text, right_name text)
    returns integer
    language sql
    immutable
    as $$
      select case
        when coalesce(left_name, '') = '' or coalesce(right_name, '') = '' then 0
        when left_name = right_name then 100
        when length(left_name) >= 2
          and length(right_name) >= 2
          and (left_name like '%' || right_name || '%' or right_name like '%' || left_name || '%') then 90
        else round(similarity(left_name, right_name) * 100)::int
      end
    $$;
  `);
  await client.query(`
    insert into reb_apt_identity_apartment_norm (
      complex_pk,
      pnu,
      lawd_cd,
      adres,
      adres_norm,
      complex_nm1,
      complex_nm2,
      complex_nm3,
      complex_nm1_norm,
      complex_nm2_norm,
      complex_nm3_norm,
      complex_gb_cd,
      dong_cnt,
      unit_cnt,
      useapr_dt,
      imported_at
    )
    select
      complex_pk,
      pnu,
      left(coalesce(pnu, ''), 5) as lawd_cd,
      adres,
      regexp_replace(lower(coalesce(adres, '')), '[^0-9a-z가-힣]', '', 'g') as adres_norm,
      complex_nm1,
      complex_nm2,
      complex_nm3,
      regexp_replace(lower(coalesce(complex_nm1, '')), '[^0-9a-z가-힣]', '', 'g') as complex_nm1_norm,
      regexp_replace(lower(coalesce(complex_nm2, '')), '[^0-9a-z가-힣]', '', 'g') as complex_nm2_norm,
      regexp_replace(lower(coalesce(complex_nm3, '')), '[^0-9a-z가-힣]', '', 'g') as complex_nm3_norm,
      complex_gb_cd,
      dong_cnt,
      unit_cnt,
      useapr_dt,
      imported_at
    from reb_apt_identity_raw
    where coalesce(complex_gb_cd, '') = '1'
      and coalesce(complex_pk, '') <> ''
  `);
}

function normalizeRebAptIdentityRow(row) {
  return {
    complexPk: stringValue(row.COMPLEX_PK ?? row.complex_pk ?? row.complexPk),
    pnu: stringValue(row.PNU ?? row.pnu),
    adres: stringValue(row.ADRES ?? row.adres),
    complexNm1: stringValue(row.COMPLEX_NM1 ?? row.complex_nm1 ?? row.complexNm1),
    complexNm2: stringValue(row.COMPLEX_NM2 ?? row.complex_nm2 ?? row.complexNm2),
    complexNm3: stringValue(row.COMPLEX_NM3 ?? row.complex_nm3 ?? row.complexNm3),
    complexGbCd: stringValue(row.COMPLEX_GB_CD ?? row.complex_gb_cd ?? row.complexGbCd),
    dongCnt: integerValue(row.DONG_CNT ?? row.dong_cnt ?? row.dongCnt),
    unitCnt: integerValue(row.UNIT_CNT ?? row.unit_cnt ?? row.unitCnt),
    useaprDt: stringValue(row.USEAPR_DT ?? row.useapr_dt ?? row.useaprDt)
  };
}

function normalizePublicDataServiceKey(value) {
  const key = String(value || "").trim();
  if (!key) return "";
  if (!/%[0-9a-f]{2}/i.test(key)) return key;
  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
}

function stringValue(value) {
  return String(value ?? "").trim();
}

function integerValue(value) {
  const normalized = String(value ?? "").replace(/,/g, "").trim();
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? Math.trunc(number) : null;
}
