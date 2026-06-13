import { query } from "./db.js";

const DEFAULT_LIMIT = 12;

export async function searchMapTargets({ q = "", limit = DEFAULT_LIMIT } = {}) {
  const keyword = String(q || "").trim();
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || DEFAULT_LIMIT, 20));
  if (!keyword) return { q: keyword, items: [] };

  const like = `%${escapeLike(keyword)}%`;
  const prefixLike = `${escapeLike(keyword)}%`;
  const [dongRows, apartmentRows] = await Promise.all([
    searchDongs({ like, prefixLike, limit: normalizedLimit }),
    searchApartments({ like, prefixLike, limit: normalizedLimit })
  ]);

  const items = [
    ...dongRows.map((row) => serializeDongResult(row, keyword)),
    ...apartmentRows.map((row) => serializeApartmentResult(row, keyword))
  ]
    .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name, "ko"))
    .slice(0, normalizedLimit)
    .map(({ score, ...item }) => item);

  return { q: keyword, items };
}

async function searchDongs({ like, prefixLike, limit }) {
  const result = await query(`
    select
      code,
      dong_name as name,
      min(address) as address,
      avg(lat)::float8 as lat,
      avg(lng)::float8 as lng,
      count(*)::int as apartment_count
    from (
      select
        coalesce(nullif(left(legal_dong_code, 8), ''), concat('addr:', coalesce(neighborhood_name, ''), ':', split_part(coalesce(address, ''), ' ', 2))) as code,
        coalesce(nullif(neighborhood_name, ''), '미분류') as dong_name,
        coalesce(address, '') as address,
        lat,
        lng
      from apartments
      where lat is not null
        and lng is not null
        and lat <> 0
        and lng <> 0
        and (
          coalesce(neighborhood_name, '') ilike $1 escape '\\'
          or coalesce(address, '') ilike $1 escape '\\'
        )
    ) as matched_dongs
    group by code, dong_name
    order by
      case
        when dong_name ilike $2 escape '\\' then 0
        when min(address) ilike $2 escape '\\' then 1
        else 2
      end,
      apartment_count desc,
      dong_name asc
    limit $3
  `, [like, prefixLike, limit]);
  return result.rows;
}

async function searchApartments({ like, prefixLike, limit }) {
  const result = await query(`
    select
      id,
      name,
      coalesce(neighborhood_name, '') as neighborhood_name,
      coalesce(address, '') as address,
      lat,
      lng
    from apartments
    where lat is not null
      and lng is not null
      and lat <> 0
      and lng <> 0
      and (
        name ilike $1 escape '\\'
        or coalesce(neighborhood_name, '') ilike $1 escape '\\'
        or coalesce(address, '') ilike $1 escape '\\'
      )
    order by
      case
        when name ilike $2 escape '\\' then 0
        when coalesce(neighborhood_name, '') ilike $2 escape '\\' then 1
        when coalesce(address, '') ilike $2 escape '\\' then 2
        else 3
      end,
      name asc
    limit $3
  `, [like, prefixLike, limit]);
  return result.rows;
}

function serializeDongResult(row, keyword) {
  const address = row.address || "";
  const name = row.name || "미분류";
  const displayName = dongDisplayName(name, address);
  return {
    type: "dong",
    id: row.code,
    name: displayName,
    rawName: name,
    meta: `${formatInt(row.apartment_count)}개 아파트`,
    address,
    lat: Number(row.lat),
    lng: Number(row.lng),
    apartmentCount: Number(row.apartment_count || 0),
    targetZoom: 16,
    score: resultScore({ keyword, name: displayName, rawName: name, address, typeRank: 0 })
  };
}

function serializeApartmentResult(row, keyword) {
  const address = row.address || "";
  const name = row.name || "";
  const neighborhoodName = row.neighborhood_name || "";
  return {
    type: "apartment",
    id: row.id,
    name,
    rawName: name,
    meta: [neighborhoodName, address].filter(Boolean).join(" · "),
    address,
    neighborhoodName,
    lat: Number(row.lat),
    lng: Number(row.lng),
    targetZoom: 16,
    score: resultScore({ keyword, name, rawName: neighborhoodName, address, typeRank: 1 })
  };
}

function dongDisplayName(name, address) {
  const parts = String(address || "").split(/\s+/).filter(Boolean);
  const sigungu = parts.slice(1).find((part) => /구$|시$|군$/.test(part));
  return sigungu ? `${sigungu} ${name}` : name;
}

function resultScore({ keyword, name, rawName, address, typeRank }) {
  const queryText = normalize(keyword);
  const values = [name, rawName, address].map(normalize).filter(Boolean);
  if (values.some((value) => value === queryText)) return typeRank;
  if (values.some((value) => value.startsWith(queryText))) return 10 + typeRank;
  if (values.some((value) => value.includes(queryText))) return 20 + typeRank;
  return 40 + typeRank;
}

function normalize(value) {
  return String(value || "").replace(/\s+/g, "").toLocaleLowerCase("ko-KR");
}

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (match) => `\\${match}`);
}

function formatInt(value) {
  return Number(value || 0).toLocaleString("ko-KR");
}
