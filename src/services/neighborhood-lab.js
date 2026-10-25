import { readFile } from "node:fs/promises";
import { withClient } from "./db.js";
import { buildLabPayload, shiftMonth } from "./neighborhood-lab-model.js";
import { getNeighborhoodArea, neighborhoodAreas } from "./neighborhood-lab-areas.js";

export const LAB_APARTMENT_IDS = ["kb:15699", "kb:15663", "kb:15449", "kb:15308", "kb:15700", "kb:23558", "kb:15042", "kb:23559", "kb:15738"];
const cached = new Map();
const pending = new Map();

function metadata(area, count, dataset, snapshot) {
  return {
    source: dataset === "validated" ? "검증용 KB 발췌 자료" : "개발 DB · KB 월별 시세", dataset,
    area: { id: area.id, label: area.label, description: area.description, pool_count: count, reference_id: area.referenceId },
    areas: neighborhoodAreas, ...(snapshot ? { snapshot } : {})
  };
}

function displayApartments(apartments, area) {
  return apartments.map(apartment => ({ ...apartment, short_name: area.id === "songpa"
    ? apartment.name.replace(/^송파파인타운/, "")
    : apartment.name.replace(/^동탄역?/, "") }));
}

async function readSnapshot(area) {
  return JSON.parse(await readFile(new URL("../fixtures/" + area.snapshot, import.meta.url), "utf8"));
}

async function readDevelopmentApartments(ids) {
  return withClient(async client => {
    await client.query("begin read only");
    try {
      await client.query("set local statement_timeout = '8s'");
      const { rows: apartments } = await client.query(`
        select a.id apt_id,a.name,a.legal_dong_code,a.lat,a.lng,
          a.built_year::integer,a.household_count households,t.id area_type_id,t.exclusive_area_m2::float8 area_m2
        from apartments a join lateral (
          select id,exclusive_area_m2 from area_types where apartment_id=a.id
          and exclusive_area_m2 between 75.6 and 92.4
          order by abs(exclusive_area_m2-84),id limit 1
        ) t on true where a.id = any($1::text[]) order by a.id
      `, [ids]);
      if (apartments.length !== ids.length) throw new Error("개발 DB의 비교 단지 자료가 부족합니다.");
      const areaIds = apartments.map(apartment => apartment.area_type_id);
      const { rows: [latest] } = await client.query(`
        select year_month from monthly_prices where area_type_id=any($1::text[])
          and source='kb_internal_mvp' and sale_mid>0
        group by year_month having count(distinct area_type_id)=$2 order by year_month desc limit 1
      `, [areaIds, areaIds.length]);
      if (!latest) throw new Error("개발 DB에서 공통 기준월을 찾지 못했습니다.");
      const { rows: prices } = await client.query(`
        select area_type_id,year_month,sale_mid from monthly_prices
        where area_type_id=any($1::text[]) and source='kb_internal_mvp'
          and year_month between $2 and $3 and sale_mid>0 order by year_month,id
      `, [areaIds, shiftMonth(latest.year_month, -42), latest.year_month]);
      const byArea = new Map(apartments.map(apartment => [apartment.area_type_id, { ...apartment, prices: {} }]));
      for (const price of prices) byArea.get(price.area_type_id).prices[price.year_month] = Number(price.sale_mid);
      await client.query("commit");
      return { apartments: [...byArea.values()], asOf: latest.year_month };
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}

export function combineNeighborhoodPayloads(payloads, areaId) {
  const focus = payloads.find(payload => payload.area.id === areaId);
  if (!focus || payloads.some(payload => payload.asOf !== focus.asOf)) throw new Error("지역 자료의 공통 기준월을 확인할 수 없습니다.");
  const items = payloads.flatMap(payload => [payload.benchmark, ...payload.current_peers].map(item => ({
    ...item, comparison_area_id: payload.area.id, comparison_area_label: payload.area.label,
    comparison_pool_count: payload.area.pool_count, comparison_missing_history_count: payload.coverage.missing_history_count
  })));
  const codes = [...new Set(payloads.flatMap(payload => payload.filters.legal_dong_codes))].sort();
  return {
    ...focus, scope: "nearby", area: { ...focus.area, pool_count: items.length,
      selection_count: focus.area.pool_count, display_label: payloads.map(payload => payload.area.label).join(" · ") },
    benchmark: items.find(item => item.apt_id === focus.benchmark.apt_id),
    current_peers: items.filter(item => item.apt_id !== focus.benchmark.apt_id),
    models: Object.assign({}, ...payloads.map(payload => payload.models)),
    focus_ids: [focus.benchmark, ...focus.current_peers].map(item => item.apt_id),
    comparison_pools: payloads.map(payload => ({ id: payload.area.id, label: payload.area.label, count: payload.area.pool_count, relationship_count: Object.keys(payload.models).length })),
    coverage: Object.fromEntries(Object.keys(focus.coverage).map(key => [key, payloads.reduce((sum, payload) => sum + payload.coverage[key], 0)])),
    filters: { ...focus.filters, legal_dong_codes: codes, same_legal_dong_code: codes.length === 1 ? codes[0] : null },
    ...(focus.snapshot ? { snapshot: { ...focus.snapshot, description: "동탄역과 동탄 목동의 지역별 검증용 KB 발췌 자료",
      comparisonPools: payloads.map(payload => ({ area: payload.area.id, provenance: payload.snapshot })) } } : {})
  };
}

export async function readNeighborhoodLab(dataset = "validated", areaId = "songpa", scope = "selected") {
  if (!["validated", "development"].includes(dataset)) {
    const error = new Error("지원하지 않는 자료입니다."); error.statusCode = 400; throw error;
  }
  if (!["selected", "nearby"].includes(scope)) {
    const error = new Error("지원하지 않는 표시 범위입니다."); error.statusCode = 400; throw error;
  }
  const area = getNeighborhoodArea(areaId);
  const key = area.id + ":" + dataset + ":" + scope;
  const previous = cached.get(key);
  if (previous && Date.now() - previous.at < 300000) return previous.data;
  if (pending.has(key)) return pending.get(key);
  const request = (async () => {
    // Load both bounded Dongtan pools so panning never replaces one area's data
    // with the other's. Model selection remains isolated inside each pool.
    const groups = scope === "nearby" && area.id.startsWith("dongtan-")
      ? [getNeighborhoodArea("dongtan-station"), getNeighborhoodArea("dongtan-mokdong")] : [area];
    const snapshots = await Promise.all(groups.map(readSnapshot));
    const development = dataset === "development"
      ? await readDevelopmentApartments(snapshots.flatMap(snapshot => snapshot.apartments.map(item => item.apt_id))) : null;
    const asOf = development?.asOf || snapshots.map(snapshot => snapshot.asOf).sort()[0];
    const payloads = groups.map((group, index) => {
      const snapshot = snapshots[index];
      const ids = new Set(snapshot.apartments.map(item => item.apt_id));
      const apartments = development ? development.apartments.filter(item => ids.has(item.apt_id)) : snapshot.apartments;
      return buildLabPayload(displayApartments(apartments, group), asOf, metadata(group, apartments.length, dataset,
        dataset === "validated" ? snapshot.provenance : undefined));
    });
    const data = payloads.length > 1 ? combineNeighborhoodPayloads(payloads, area.id) : payloads[0];
    cached.set(key, { at: Date.now(), data });
    return data;
  })();
  pending.set(key, request);
  try { return await request; } finally { pending.delete(key); }
}
