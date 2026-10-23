import { KBPriceProvider, normalizeMonthlyPrices } from "../providers/kb-price-provider.js";
import { query, withClient } from "./db.js";

export function kstMonth(now = new Date()) {
  return new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 7).replace("-", "");
}

export function shiftMonth(month, delta) {
  const date = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(4)) - 1 + delta, 1));
  return date.toISOString().slice(0, 7).replace("-", "");
}

export function priceWindow(latestMonth, endMonth) {
  const recentStart = shiftMonth(endMonth, -2);
  const startMonth = latestMonth && latestMonth < recentStart ? latestMonth : recentStart;
  const years = [];
  for (let year = Number(startMonth.slice(0, 4)); year <= Number(endMonth.slice(0, 4)); year += 1) years.push(String(year));
  return { startMonth, endMonth, years };
}

export function normalizeFetchedPrices(area, groups, window) {
  const prices = normalizeMonthlyPrices({
    id: area.id,
    supplyAreaPyeong: Number(area.supply_area_pyeong),
    exclusiveAreaPyeong: Number(area.exclusive_area_pyeong)
  }, groups);
  return [...new Map(prices.filter((p) => /^\d{6}$/.test(String(p.yearMonth))
    && p.yearMonth >= window.startMonth && p.yearMonth <= window.endMonth).map((p) => [p.id, p])).values()];
}

export function requestPacer(intervalMs, { now = Date.now, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  let next = 0;
  return async () => {
    const slot = Math.max(now(), next);
    next = slot + intervalMs;
    if (slot > now()) await sleep(slot - now());
  };
}

export async function runKbDailyCollection({
  provider = new KBPriceProvider(),
  delayMs = 250,
  concurrency = 3,
  limit = 0,
  resume = true,
  endMonth = kstMonth(),
  onProgress = (summary) => console.log(JSON.stringify({ message: "KB daily progress", ...summary }))
} = {}) {
  const result = await query("select at.id, at.source_area_id, at.supply_area_pyeong, at.exclusive_area_pyeong, a.source_complex_id, latest.year_month as latest_month, f.last_success_at, f.status as fetch_status from area_types at join apartments a on a.id = at.apartment_id left join kb_daily_area_fetches f on f.area_type_id = at.id left join lateral (select year_month from monthly_prices where area_type_id = at.id order by year_month desc limit 1) latest on true where a.source = 'kb_internal_mvp' and a.source_complex_id is not null and (coalesce(at.supply_area_pyeong,0) > 0 or coalesce(at.exclusive_area_pyeong,0) > 0) order by f.last_success_at nulls first, at.id");
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  const fresh = (row) => resume && ["completed","no_price"].includes(row.fetch_status) && row.last_success_at
    && new Date(new Date(row.last_success_at).getTime() + 9 * 3600000).toISOString().slice(0, 10) === today;
  const pending = result.rows.filter((row) => !fresh(row));
  const targets = limit > 0 ? pending.slice(0, limit) : pending;
  const summary = { totalAreas: result.rows.length, alreadyCompletedToday: result.rows.length - pending.length,
    selectedAreas: targets.length, completedAreas: 0, noPriceAreas: 0, failedAreas: 0, savedPrices: 0,
    latestMonth: null, partial: limit > 0 && targets.length < pending.length };
  if (!summary.totalAreas) throw new Error("No existing KB area types; refusing an empty successful collection");
  let position = 0;
  let consecutiveFailures = 0;
  let stopped = false;
  const pace = requestPacer(delayMs);
  const failures = [];
  async function worker() {
    while (position < targets.length && !stopped) {
      const area = targets[position++];
      try {
        await pace();
        const window = priceWindow(area.latest_month, endMonth);
        const groups = await provider.fetchHistoricalPrices(area.source_complex_id, area.source_area_id, window.years);
        const prices = normalizeFetchedPrices(area, groups, window);
        await saveAreaResult(area.id, prices);
        summary.completedAreas += 1;
        if (!prices.length) summary.noPriceAreas += 1;
        summary.savedPrices += prices.length;
        for (const price of prices) if (!summary.latestMonth || price.yearMonth > summary.latestMonth) summary.latestMonth = price.yearMonth;
        consecutiveFailures = 0;
      } catch (error) {
        summary.failedAreas += 1;
        consecutiveFailures += 1;
        const message = String(error?.message || error).slice(0, 500);
        failures.push({ areaTypeId: area.id, error: message });
        await query("insert into kb_daily_area_fetches(area_type_id,status,last_attempt_at,error_message) values($1,'failed',now(),$2) on conflict(area_type_id) do update set status='failed',last_attempt_at=now(),error_message=excluded.error_message", [area.id, message]);
        if (consecutiveFailures >= 10) stopped = true;
      }
      if ((summary.completedAreas + summary.failedAreas) % 100 === 0) onProgress(summary);
    }
  }
  await Promise.all(Array.from({length: Math.max(1, Math.min(8, concurrency))}, worker));
  const verification = await query("select count(*)::int as total, count(*) filter(where f.last_success_at >= ($1::date::timestamp at time zone 'Asia/Seoul'))::int as fresh, max(f.latest_month) as latest_month, count(*) filter(where f.status='failed')::int as failed from area_types at join apartments a on a.id=at.apartment_id left join kb_daily_area_fetches f on f.area_type_id=at.id where a.source='kb_internal_mvp' and a.source_complex_id is not null and (coalesce(at.supply_area_pyeong,0)>0 or coalesce(at.exclusive_area_pyeong,0)>0)", [today]);
  const actual = verification.rows[0];
  summary.verifiedFreshAreas = actual.fresh;
  summary.verifiedLatestMonth = actual.latest_month;
  summary.failures = failures.slice(0, 20);
  summary.status = !summary.partial && summary.failedAreas === 0 && actual.fresh === actual.total
    && actual.latest_month >= shiftMonth(endMonth, -1) ? "succeeded" : "failed";
  return summary;
}

async function saveAreaResult(areaTypeId, prices) {
  await withClient(async (client) => {
    await client.query("begin");
    try {
      if (prices.length) {
        const values = prices.map((p) => ({id:p.id,area_type_id:p.areaTypeId,year_month:p.yearMonth,
          sale_low:p.saleLow,sale_mid:p.saleMid,sale_high:p.saleHigh,pyeong_price:p.pyeongPrice,source:p.source}));
        await client.query("insert into monthly_prices(id,area_type_id,year_month,sale_low,sale_mid,sale_high,pyeong_price,source,updated_at) select x.id,x.area_type_id,x.year_month,x.sale_low,x.sale_mid,x.sale_high,x.pyeong_price,x.source,now() from jsonb_to_recordset($1::jsonb) as x(id text,area_type_id text,year_month text,sale_low int,sale_mid int,sale_high int,pyeong_price int,source text) on conflict(id) do update set sale_low=excluded.sale_low,sale_mid=excluded.sale_mid,sale_high=excluded.sale_high,pyeong_price=excluded.pyeong_price,updated_at=now()", [JSON.stringify(values)]);
      }
      const latestMonth = prices.length ? prices.reduce((max,p) => p.yearMonth > max ? p.yearMonth : max, "") : null;
      await client.query("insert into kb_daily_area_fetches(area_type_id,status,price_count,latest_month,last_attempt_at,last_success_at,error_message) values($1,$2,$3,$4,now(),now(),null) on conflict(area_type_id) do update set status=excluded.status,price_count=excluded.price_count,latest_month=coalesce(excluded.latest_month,kb_daily_area_fetches.latest_month),last_attempt_at=now(),last_success_at=now(),error_message=null", [areaTypeId,prices.length ? "completed" : "no_price",prices.length,latestMonth]);
      await client.query("commit");
    } catch(error) { await client.query("rollback"); throw error; }
  });
}
