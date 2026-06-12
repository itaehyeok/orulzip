import { query, withClient } from "./db.js";

export async function readDatasetFromDb() {
  const [apartments, areaTypes, monthlyPrices] = await Promise.all([
    query(`select * from apartments order by name`),
    query(`select * from area_types order by apartment_id, supply_area_pyeong nulls last`),
    query(`select * from monthly_prices order by area_type_id, year_month`)
  ]);

  return {
    meta: {
      source: "kb_internal_mvp",
      syncedAt: await latestUpdatedAt()
    },
    apartments: apartments.rows.map((row) => ({
      id: row.id,
      regionId: row.region_id,
      source: row.source,
      sourceComplexId: Number(row.source_complex_id),
      name: row.name,
      neighborhoodName: row.neighborhood_name || "",
      legalDongCode: row.legal_dong_code || "",
      address: row.address || "",
      builtYear: row.built_year || "",
      householdCount: Number(row.household_count || 0),
      lat: Number(row.lat || 0),
      lng: Number(row.lng || 0)
    })),
    areaTypes: areaTypes.rows.map((row) => ({
      id: row.id,
      apartmentId: row.apartment_id,
      sourceAreaId: Number(row.source_area_id),
      label: row.label || "",
      supplyAreaM2: Number(row.supply_area_m2 || 0),
      supplyAreaPyeong: Number(row.supply_area_pyeong || 0),
      exclusiveAreaM2: Number(row.exclusive_area_m2 || 0),
      exclusiveAreaPyeong: Number(row.exclusive_area_pyeong || 0),
      householdCount: Number(row.household_count || 0)
    })),
    monthlyPrices: monthlyPrices.rows.map((row) => ({
      id: row.id,
      areaTypeId: row.area_type_id,
      yearMonth: row.year_month,
      saleLow: Number(row.sale_low || 0),
      saleMid: Number(row.sale_mid || 0),
      saleHigh: Number(row.sale_high || 0),
      pyeongPrice: Number(row.pyeong_price || 0),
      source: row.source
    }))
  };
}

export async function upsertCollectedData({ apartments, areaTypes, monthlyPrices }) {
  await withClient(async (client) => {
    await client.query("begin");
    try {
      for (const apartment of apartments) {
        await client.query(`
          insert into apartments (
            id, region_id, source, source_complex_id, name, neighborhood_name, legal_dong_code,
            address, built_year, household_count, lat, lng, updated_at
          ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now())
          on conflict (id) do update set
            region_id = excluded.region_id,
            source = excluded.source,
            source_complex_id = excluded.source_complex_id,
            name = excluded.name,
            neighborhood_name = excluded.neighborhood_name,
            legal_dong_code = excluded.legal_dong_code,
            address = excluded.address,
            built_year = excluded.built_year,
            household_count = excluded.household_count,
            lat = excluded.lat,
            lng = excluded.lng,
            updated_at = now()
        `, [
          apartment.id,
          apartment.regionId,
          apartment.source,
          apartment.sourceComplexId,
          apartment.name,
          apartment.neighborhoodName,
          apartment.legalDongCode,
          apartment.address,
          apartment.builtYear,
          apartment.householdCount,
          apartment.lat,
          apartment.lng
        ]);
      }

      for (const areaType of areaTypes) {
        await client.query(`
          insert into area_types (
            id, apartment_id, source_area_id, label, supply_area_m2, supply_area_pyeong,
            exclusive_area_m2, exclusive_area_pyeong, household_count, updated_at
          ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
          on conflict (id) do update set
            label = excluded.label,
            supply_area_m2 = excluded.supply_area_m2,
            supply_area_pyeong = excluded.supply_area_pyeong,
            exclusive_area_m2 = excluded.exclusive_area_m2,
            exclusive_area_pyeong = excluded.exclusive_area_pyeong,
            household_count = excluded.household_count,
            updated_at = now()
        `, [
          areaType.id,
          areaType.apartmentId,
          areaType.sourceAreaId,
          areaType.label,
          areaType.supplyAreaM2,
          areaType.supplyAreaPyeong,
          areaType.exclusiveAreaM2,
          areaType.exclusiveAreaPyeong,
          areaType.householdCount
        ]);
      }

      for (const price of monthlyPrices) {
        await client.query(`
          insert into monthly_prices (
            id, area_type_id, year_month, sale_low, sale_mid, sale_high, pyeong_price, source, updated_at
          ) values ($1,$2,$3,$4,$5,$6,$7,$8,now())
          on conflict (id) do update set
            sale_low = excluded.sale_low,
            sale_mid = excluded.sale_mid,
            sale_high = excluded.sale_high,
            pyeong_price = excluded.pyeong_price,
            source = excluded.source,
            updated_at = now()
        `, [
          price.id,
          price.areaTypeId,
          price.yearMonth,
          price.saleLow,
          price.saleMid,
          price.saleHigh,
          price.pyeongPrice,
          price.source
        ]);
      }

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}

export async function latestJob() {
  const result = await query(`
    select * from crawl_jobs
    order by
      case
        when status in ('discovering', 'running') then 0
        when status = 'requested' then 1
        else 2
      end,
      created_at desc
    limit 1
  `);
  return result.rows[0] || null;
}

export async function createCrawlJob(options) {
  const result = await query(`
    insert into crawl_jobs (
      region_id, status, max_complexes, years_back, max_area_types_per_complex,
      max_tiles, delay_min_ms, delay_max_ms
    ) values ($1,'requested',$2,$3,$4,$5,$6,$7)
    returning *
  `, [
    options.regionId,
    options.maxComplexes,
    options.yearsBack,
    options.maxAreaTypesPerComplex,
    options.maxTiles,
    options.delayMinMs,
    options.delayMaxMs
  ]);
  return result.rows[0];
}

export async function crawlStatus() {
  const job = await latestJob();
  if (!job) return null;
  const queue = await query(`
    select status, count(*)::int as count
    from crawl_queue
    where job_id = $1
    group by status
  `, [job.id]);
  const logs = await query(`
    select level, message, details, created_at
    from crawl_logs
    where job_id = $1
    order by created_at desc
    limit 20
  `, [job.id]);
  return {
    job,
    queue: queue.rows,
    logs: logs.rows
  };
}

export async function crawlDetails({ status = "", limit = 200 } = {}) {
  const job = await latestJob();
  if (!job) {
    return {
      job: null,
      queueCounts: [],
      rows: []
    };
  }

  const safeLimit = Math.max(1, Math.min(Number(limit) || 200, 500));
  const params = [job.id];
  let statusClause = "";
  if (status) {
    params.push(status);
    statusClause = `and status = $${params.length}`;
  }
  params.push(safeLimit);

  const [queueCounts, rows] = await Promise.all([
    query(`
      select status, count(*)::int as count
      from crawl_queue
      where job_id = $1
      group by status
      order by status
    `, [job.id]),
    query(`
      select
        id,
        source_complex_id,
        marker->>'단지명' as complex_name,
        marker->>'평수' as pyeong,
        marker->>'매매평균가' as marker_sale_avg,
        marker->>'매매평당가' as marker_pyeong_price,
        marker->>'기준년월일' as marker_base_date,
        status,
        attempts,
        error_message,
        started_at,
        completed_at,
        updated_at
      from crawl_queue
      where job_id = $1
      ${statusClause}
      order by
        case status
          when 'running' then 0
          when 'failed' then 1
          when 'pending' then 2
          when 'completed' then 3
          else 4
        end,
        updated_at desc,
        id desc
      limit $${params.length}
    `, params)
  ]);

  return {
    job,
    queueCounts: queueCounts.rows,
    rows: rows.rows
  };
}

async function latestUpdatedAt() {
  const result = await query(`
    select max(updated_at) as updated_at from monthly_prices
  `);
  return result.rows[0]?.updated_at || null;
}
