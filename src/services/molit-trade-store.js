import crypto from "node:crypto";
import { query, withClient } from "./db.js";

export async function latestKbPricePeriod() {
  const result = await query(`
    select min(year_month) as start_month, max(year_month) as end_month
    from monthly_prices
  `);
  const row = result.rows[0] || {};
  return {
    startMonth: row.start_month || "",
    endMonth: row.end_month || ""
  };
}

export async function completedFetchSet() {
  const result = await query(`
    select target_region_id, lawd_cd, year_month
    from molit_trade_fetches
    where status = 'completed'
  `);
  return new Set(result.rows.map((row) => fetchKey(row.target_region_id, row.lawd_cd, row.year_month)));
}

export async function markTradeFetchStarted({ targetRegionId, lawdCd, lawdName, yearMonth }) {
  await query(`
    insert into molit_trade_fetches (
      target_region_id, lawd_cd, lawd_name, year_month, status, started_at, updated_at
    ) values ($1,$2,$3,$4,'running',now(),now())
    on conflict (target_region_id, lawd_cd, year_month) do update set
      lawd_name = excluded.lawd_name,
      status = 'running',
      error_message = null,
      started_at = coalesce(molit_trade_fetches.started_at, now()),
      completed_at = null,
      updated_at = now()
  `, [targetRegionId, lawdCd, lawdName, yearMonth]);
}

export async function markTradeFetchCompleted({
  targetRegionId,
  lawdCd,
  yearMonth,
  totalCount,
  fetchedCount,
  savedCount,
  filteredCount,
  pageCount
}) {
  await query(`
    update molit_trade_fetches
    set status = 'completed',
        total_count = $4,
        fetched_count = $5,
        saved_count = $6,
        filtered_count = $7,
        page_count = $8,
        error_message = null,
        completed_at = now(),
        updated_at = now()
    where target_region_id = $1 and lawd_cd = $2 and year_month = $3
  `, [targetRegionId, lawdCd, yearMonth, totalCount, fetchedCount, savedCount, filteredCount, pageCount]);
}

export async function markTradeFetchFailed({ targetRegionId, lawdCd, yearMonth, error }) {
  await query(`
    update molit_trade_fetches
    set status = 'failed',
        error_message = $4,
        completed_at = now(),
        updated_at = now()
    where target_region_id = $1 and lawd_cd = $2 and year_month = $3
  `, [targetRegionId, lawdCd, yearMonth, error.message || String(error)]);
}

export async function upsertTradeDeals({ targetRegionId, lawdCd, yearMonth, deals }) {
  const normalized = deals.map((deal) => normalizeTradeDeal({ targetRegionId, lawdCd, yearMonth, deal }));

  await withClient(async (client) => {
    await client.query("begin");
    try {
      for (const deal of normalized) {
        await client.query(`
          insert into molit_trade_deals (
            id, source, target_region_id, lawd_cd, sgg_cd, deal_year_month,
            deal_year, deal_month, deal_day, apt_name, apt_dong, legal_dong, jibun,
            floor, build_year, exclusive_area_m2, deal_amount, pyeong_price,
            cancel_type, cancel_day, registration_date, dealing_type,
            estate_agent_sgg_name, buyer_type, seller_type, raw, updated_at
          ) values (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
            $19,$20,$21,$22,$23,$24,$25,$26,now()
          )
          on conflict (id) do update set
            target_region_id = excluded.target_region_id,
            lawd_cd = excluded.lawd_cd,
            sgg_cd = excluded.sgg_cd,
            deal_year_month = excluded.deal_year_month,
            deal_year = excluded.deal_year,
            deal_month = excluded.deal_month,
            deal_day = excluded.deal_day,
            apt_name = excluded.apt_name,
            apt_dong = excluded.apt_dong,
            legal_dong = excluded.legal_dong,
            jibun = excluded.jibun,
            floor = excluded.floor,
            build_year = excluded.build_year,
            exclusive_area_m2 = excluded.exclusive_area_m2,
            deal_amount = excluded.deal_amount,
            pyeong_price = excluded.pyeong_price,
            cancel_type = excluded.cancel_type,
            cancel_day = excluded.cancel_day,
            registration_date = excluded.registration_date,
            dealing_type = excluded.dealing_type,
            estate_agent_sgg_name = excluded.estate_agent_sgg_name,
            buyer_type = excluded.buyer_type,
            seller_type = excluded.seller_type,
            raw = excluded.raw,
            updated_at = now()
        `, [
          deal.id,
          deal.source,
          deal.targetRegionId,
          deal.lawdCd,
          deal.sggCd,
          deal.dealYearMonth,
          deal.dealYear,
          deal.dealMonth,
          deal.dealDay,
          deal.aptName,
          deal.aptDong,
          deal.legalDong,
          deal.jibun,
          deal.floor,
          deal.buildYear,
          deal.exclusiveAreaM2,
          deal.dealAmount,
          deal.pyeongPrice,
          deal.cancelType,
          deal.cancelDay,
          deal.registrationDate,
          deal.dealingType,
          deal.estateAgentSggName,
          deal.buyerType,
          deal.sellerType,
          deal.raw
        ]);
      }
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });

  return normalized.length;
}

export async function tradeCollectionSummary() {
  const [deals, fetches] = await Promise.all([
    query(`
      select target_region_id, min(deal_year_month) as start_month, max(deal_year_month) as end_month, count(*)::int as deals
      from molit_trade_deals
      group by target_region_id
      order by target_region_id
    `),
    query(`
      select target_region_id, status, count(*)::int as count
      from molit_trade_fetches
      group by target_region_id, status
      order by target_region_id, status
    `)
  ]);
  return { deals: deals.rows, fetches: fetches.rows };
}

export function fetchKey(targetRegionId, lawdCd, yearMonth) {
  return `${targetRegionId}:${lawdCd}:${yearMonth}`;
}

function normalizeTradeDeal({ targetRegionId, lawdCd, yearMonth, deal }) {
  const dealAmount = toInteger(pick(deal, ["dealAmount", "거래금액"]));
  const exclusiveAreaM2 = toNumber(pick(deal, ["excluUseAr", "전용면적"]));
  const pyeongPrice = dealAmount && exclusiveAreaM2
    ? Math.round(dealAmount / (exclusiveAreaM2 / 3.305785))
    : null;
  const normalized = {
    source: "molit_apt_trade_detail",
    targetRegionId,
    lawdCd,
    sggCd: pick(deal, ["sggCd", "지역코드"]) || lawdCd,
    dealYearMonth: yearMonth,
    dealYear: toInteger(pick(deal, ["dealYear", "년"])),
    dealMonth: toInteger(pick(deal, ["dealMonth", "월"])),
    dealDay: toInteger(pick(deal, ["dealDay", "일"])),
    aptName: pick(deal, ["aptNm", "아파트"]) || "",
    aptDong: pick(deal, ["aptDong", "aptDongNm", "동"]) || "",
    legalDong: pick(deal, ["umdNm", "법정동"]) || "",
    jibun: pick(deal, ["jibun", "지번"]) || "",
    floor: toInteger(pick(deal, ["floor", "층"])),
    buildYear: toInteger(pick(deal, ["buildYear", "건축년도"])),
    exclusiveAreaM2,
    dealAmount,
    pyeongPrice,
    cancelType: pick(deal, ["cdealType", "해제여부"]) || "",
    cancelDay: pick(deal, ["cdealDay", "해제사유발생일"]) || "",
    registrationDate: pick(deal, ["rgstDate", "등기일자"]) || "",
    dealingType: pick(deal, ["dealingGbn", "거래유형"]) || "",
    estateAgentSggName: pick(deal, ["estateAgentSggNm", "중개사소재지"]) || "",
    buyerType: pick(deal, ["buyerGbn", "매수자"]) || "",
    sellerType: pick(deal, ["slerGbn", "매도자"]) || "",
    raw: deal
  };
  normalized.id = tradeDealId(normalized);
  return normalized;
}

function tradeDealId(deal) {
  const key = [
    deal.source,
    deal.lawdCd,
    deal.dealYearMonth,
    deal.dealDay,
    deal.aptName,
    deal.aptDong,
    deal.legalDong,
    deal.jibun,
    deal.floor,
    deal.exclusiveAreaM2,
    deal.dealAmount,
    deal.registrationDate
  ].join("|");
  return `molit:${crypto.createHash("sha1").update(key).digest("hex")}`;
}

function pick(object, keys) {
  for (const key of keys) {
    if (object[key] !== undefined && object[key] !== null && object[key] !== "") return object[key];
  }
  return "";
}

function toInteger(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(String(value).replaceAll(",", "").trim());
  return Number.isFinite(number) ? Math.trunc(number) : null;
}

function toNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(String(value).replaceAll(",", "").trim());
  return Number.isFinite(number) ? number : null;
}
