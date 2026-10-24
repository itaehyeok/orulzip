import { readFile } from "node:fs/promises";
import { withClient } from "./db.js";
import { buildLabPayload, shiftMonth } from "./neighborhood-lab-model.js";

export const LAB_APARTMENT_IDS = ["kb:15699", "kb:15663", "kb:15449", "kb:15308", "kb:15700", "kb:23558", "kb:15042", "kb:23559", "kb:15738"];
const cached = new Map();
const pending = new Map();

async function readDevelopmentData() {
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
      `, [LAB_APARTMENT_IDS]);
      if (apartments.length !== LAB_APARTMENT_IDS.length) throw new Error("개발 DB의 비교 단지 자료가 부족합니다.");
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
      return buildLabPayload([...byArea.values()], latest.year_month, { source: "개발 DB · KB 월별 시세", dataset: "development" });
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}

export async function readNeighborhoodLab(dataset = "validated") {
  if (!["validated", "development"].includes(dataset)) {
    const error = new Error("지원하지 않는 자료입니다."); error.statusCode = 400; throw error;
  }
  const previous = cached.get(dataset);
  if (previous && Date.now() - previous.at < 300000) return previous.data;
  if (pending.has(dataset)) return pending.get(dataset);
  const request = (async () => {
    const data = dataset === "development" ? await readDevelopmentData() : await (async () => {
      const snapshot = JSON.parse(await readFile(new URL("../fixtures/neighborhood-lab-snapshot.json", import.meta.url), "utf8"));
      return buildLabPayload(snapshot.apartments, snapshot.asOf, {
        source: "검증용 KB 발췌 자료", dataset: "validated", snapshot: snapshot.provenance
      });
    })();
    cached.set(dataset, { at: Date.now(), data });
    return data;
  })();
  pending.set(dataset, request);
  try { return await request; } finally { pending.delete(dataset); }
}
