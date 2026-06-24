import { query, withClient } from "./db.js";
import { readAppOverviewCache } from "./app-overview-cache.js";
import { kbCollectionRegions, legalDongCodePrefixes, listTiles } from "./region-config.js";

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

export async function readFilterOptions({ regionId = "" } = {}) {
  const overview = await readAppOverviewCache();
  const neighborhoods = overview.neighborhoods
    .filter((row) => !regionId || row.regionId === regionId)
    .map((row) => ({
      name: row.name,
      legalDongCode: row.legalDongCode
    }));

  return {
    months: overview.months,
    regionStats: overview.regionStats,
    neighborhoods
  };
}

export async function readStatusOverview({ includeCrawl = true } = {}) {
  const [overview, crawl] = await Promise.all([
    readAppOverviewCache(),
    includeCrawl ? crawlStatus() : Promise.resolve(null)
  ]);

  return {
    meta: overview.meta,
    counts: overview.counts,
    months: overview.months,
    crawl,
    mapCache: overview.mapCache,
    overviewCache: overview.cache
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
      max_tiles, delay_min_ms, delay_max_ms, source_job_id
    ) values ($1,'requested',$2,$3,$4,$5,$6,$7,$8)
    returning *
  `, [
    options.regionId,
    options.maxComplexes,
    options.yearsBack,
    options.maxAreaTypesPerComplex,
    options.maxTiles,
    options.delayMinMs,
    options.delayMaxMs,
    options.sourceJobId || null
  ]);
  return result.rows[0];
}

export async function crawlStatus() {
  const job = await latestJob();
  const collectionRegionIds = kbCollectionRegions().map((region) => region.id);
  const [queue, logs, trackedJobs, kbCoverage] = await Promise.all([
    job
      ? query(`
        select status, count(*)::int as count
        from crawl_queue
        where job_id = $1
        group by status
      `, [job.id])
      : { rows: [] },
    job
      ? query(`
        select level, message, details, created_at
        from crawl_logs
        where job_id = $1
        order by created_at desc
        limit 20
      `, [job.id])
      : { rows: [] },
    query(`
      select *
      from (
        select
          j.*,
          row_number() over (
            partition by j.region_id, j.years_back
            order by j.created_at desc
          ) as row_number
        from crawl_jobs j
        where j.region_id = any($1::text[])
          and (
            j.status in ('requested', 'discovering', 'running')
            or j.years_back in (0, 3, 10)
            or j.created_at >= now() - interval '7 days'
          )
      ) ranked
      where row_number = 1
      order by
        array_position($1::text[], region_id),
        years_back
    `, [collectionRegionIds]),
    kbCollectionCoverage()
  ]);
  const trackedIds = trackedJobs.rows.map((row) => row.id);
  const trackedQueue = trackedIds.length
    ? await query(`
        select job_id, status, count(*)::int as count
        from crawl_queue
        where job_id = any($1::bigint[])
        group by job_id, status
      `, [trackedIds])
    : { rows: [] };
  const trackedRecent = trackedIds.length
    ? await query(`
        select
          job_id,
          count(*) filter (where completed_at >= now() - interval '10 minutes')::int as completed_last_10_minutes,
          count(*) filter (where completed_at >= now() - interval '1 hour')::int as completed_last_hour,
          count(*) filter (where completed_at >= now() - interval '24 hours')::int as completed_last_day
        from crawl_queue
        where job_id = any($1::bigint[])
          and status = 'completed'
          and completed_at is not null
        group by job_id
      `, [trackedIds])
    : { rows: [] };
  const trackedRecentLabels = trackedIds.length
    ? await query(`
        select
          job_id,
          label,
          count(*)::int as count
        from (
          select
            q.job_id,
            coalesce(
              nullif(q.marker->>'읍면동명', ''),
              nullif(q.marker->>'법정동명', ''),
              nullif(q.marker->>'읍면동', ''),
              nullif(q.marker->>'법정동', ''),
              nullif(a.neighborhood_name, ''),
              j.region_id
            ) as label
          from crawl_queue q
          join crawl_jobs j on j.id = q.job_id
          left join apartments a
            on a.region_id = j.region_id
           and a.source_complex_id = q.source_complex_id
          where q.job_id = any($1::bigint[])
            and q.status = 'completed'
            and q.completed_at >= now() - interval '1 hour'
        ) recent
        group by job_id, label
        order by job_id, count desc, label
      `, [trackedIds])
    : { rows: [] };

  return {
    job,
    queue: queue.rows,
    logs: logs.rows,
    trackedJobs: trackedJobs.rows,
    trackedQueue: trackedQueue.rows,
    trackedRecent: trackedRecent.rows,
    trackedRecentLabels: trackedRecentLabels.rows,
    kbCoverage
  };
}

export async function kbCollectionCoverage() {
  const regionDefinitions = kbCollectionRegions().map((region) => ({
    id: region.id,
    name: region.name,
    prefixes: legalDongCodePrefixes(region),
    tileCount: listTiles(region).length
  }));
  const regionIds = regionDefinitions.map((region) => region.id);
  if (!regionDefinitions.length) return [];

  const [stored, jobs, queue] = await Promise.all([
    query(`
      with defs as (
        select
          value->>'id' as id,
          value->>'name' as name,
          coalesce((value->>'tileCount')::int, 0) as tile_count,
          array(select jsonb_array_elements_text(value->'prefixes')) as prefixes
        from jsonb_array_elements($1::jsonb) value
      )
      select
        d.id,
        d.name,
        d.tile_count,
        count(distinct a.source_complex_id)::int as stored_complexes,
        count(distinct at.id)::int as area_types
      from defs d
      left join apartments a
        on a.region_id = d.id
        or exists (
          select 1
          from unnest(d.prefixes) prefix
          where coalesce(a.legal_dong_code, '') like prefix || '%'
        )
      left join area_types at on at.apartment_id = a.id
      group by d.id, d.name, d.tile_count
    `, [JSON.stringify(regionDefinitions)]),
    query(`
      select *
      from (
        select
          j.*,
          row_number() over (partition by j.region_id order by j.created_at desc) as row_number
        from crawl_jobs j
        where j.region_id = any($1::text[])
      ) ranked
      where row_number = 1
    `, [regionIds]),
    query(`
      with active_jobs as (
        select *
        from crawl_jobs
        where region_id = any($1::text[])
          and years_back = 0
          and status in ('requested', 'discovering', 'running')
      ),
      job_summary as (
        select
          region_id,
          count(*)::int as active_jobs,
          coalesce(sum(total_complexes), 0)::int as active_total,
          coalesce(sum(completed_complexes), 0)::int as active_completed,
          coalesce(sum(failed_complexes), 0)::int as active_failed
        from active_jobs
        group by region_id
      ),
      queue_summary as (
        select
          j.region_id,
          count(q.id) filter (where q.status = 'pending')::int as active_pending,
          count(q.id) filter (where q.status = 'running')::int as active_running,
          count(q.id) filter (where q.status = 'completed')::int as active_queue_completed,
          count(q.id) filter (where q.status = 'failed')::int as active_queue_failed
        from active_jobs j
        left join crawl_queue q on q.job_id = j.id
        group by j.region_id
      )
      select
        coalesce(js.region_id, qs.region_id) as region_id,
        coalesce(js.active_jobs, 0)::int as active_jobs,
        coalesce(js.active_total, 0)::int as active_total,
        coalesce(js.active_completed, 0)::int as active_completed,
        coalesce(js.active_failed, 0)::int as active_failed,
        coalesce(qs.active_pending, 0)::int as active_pending,
        coalesce(qs.active_running, 0)::int as active_running,
        coalesce(qs.active_queue_completed, 0)::int as active_queue_completed,
        coalesce(qs.active_queue_failed, 0)::int as active_queue_failed
      from job_summary js
      full join queue_summary qs on qs.region_id = js.region_id
    `, [regionIds])
  ]);

  const storedByRegion = new Map(stored.rows.map((row) => [row.id, row]));
  const latestJobByRegion = new Map(jobs.rows.map((row) => [row.region_id, row]));
  const queueByRegion = new Map(queue.rows.map((row) => [row.region_id, row]));

  return regionDefinitions.map((region) => {
    const storedRow = storedByRegion.get(region.id) || {};
    const jobRow = latestJobByRegion.get(region.id) || null;
    const queueRow = queueByRegion.get(region.id) || {};
    const storedComplexes = Number(storedRow.stored_complexes || 0);
    const activePending = Number(queueRow.active_pending || 0);
    const activeRunning = Number(queueRow.active_running || 0);
    const activeFailed = Number(queueRow.active_queue_failed || 0);
    const knownTarget = storedComplexes + activePending + activeRunning + activeFailed;
    const activeTotal = Number(queueRow.active_total || 0);
    const activeDone = Number(queueRow.active_completed || 0) + Number(queueRow.active_failed || 0);

    return {
      regionId: region.id,
      regionName: region.name,
      prefixes: region.prefixes,
      tileCount: Number(storedRow.tile_count || region.tileCount || 0),
      storedComplexes,
      areaTypes: Number(storedRow.area_types || 0),
      knownTarget,
      storedPercent: knownTarget ? Math.round((storedComplexes / knownTarget) * 1000) / 10 : 0,
      activeJobs: Number(queueRow.active_jobs || 0),
      activeTotal,
      activeCompleted: Number(queueRow.active_completed || 0),
      activeFailed: Number(queueRow.active_failed || 0),
      activePending,
      activeRunning,
      activeQueueCompleted: Number(queueRow.active_queue_completed || 0),
      activeQueueFailed: Number(queueRow.active_queue_failed || 0),
      activeProgressPercent: activeTotal ? Math.round((activeDone / activeTotal) * 1000) / 10 : null,
      latestJob: jobRow ? {
        id: Number(jobRow.id),
        status: jobRow.status,
        yearsBack: Number(jobRow.years_back || 0),
        totalComplexes: Number(jobRow.total_complexes || 0),
        completedComplexes: Number(jobRow.completed_complexes || 0),
        failedComplexes: Number(jobRow.failed_complexes || 0),
        createdAt: jobRow.created_at,
        updatedAt: jobRow.updated_at,
        finishedAt: jobRow.finished_at
      } : null
    };
  });
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
