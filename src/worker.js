import { KBPriceProvider } from "./providers/kb-price-provider.js";
import { initDb, query, withClient } from "./services/db.js";
import { upsertCollectedData } from "./services/db-store.js";
import { refreshMapGrowthCacheIfUnlocked } from "./services/map-growth-cache.js";
import {
  getRegion,
  legalDongCodeMatchesRegion,
  legalDongCodePrefixes
} from "./services/region-config.js";

const provider = new KBPriceProvider();
const idleDelayMs = Number(process.env.WORKER_IDLE_DELAY_MS || 5000);
const staleRunningMinutes = Number(process.env.WORKER_STALE_RUNNING_MINUTES || 240);
const workerRegionIds = parseWorkerRegionIds(process.env.WORKER_REGION_IDS || "");
const workerYearsBack = parseNumberList(process.env.WORKER_YEARS_BACKS || "");
const workerMaxItemAttempts = Math.max(1, Number(process.env.WORKER_MAX_ITEM_ATTEMPTS || 3));
const workerRefreshMapCacheEnabled = booleanValue(process.env.WORKER_REFRESH_MAP_CACHE_ENABLED, true);
const workerRefreshMapCacheYearsBack = parseNumberList(process.env.WORKER_REFRESH_MAP_CACHE_YEARS_BACKS || "");

await initDb();
console.log(`KB worker started${workerRegionIds.length ? ` for ${workerRegionIds.join(",")}` : ""}${workerYearsBack.length ? ` / years_back ${workerYearsBack.join(",")}` : ""}`);
await recoverStaleRunningItems();

while (true) {
  try {
    await recoverStaleRunningItems();
    const job = await getRunnableJob();
    if (!job) {
      await sleep(idleDelayMs);
      continue;
    }

    if (job.status === "requested" || job.status === "discovering") {
      await discoverJob(job);
      continue;
    }

    if (job.status === "running") {
      const processed = await processNextQueueItem(job);
      if (!processed) {
        await finishIfDone(job);
        await sleep(idleDelayMs);
      }
    }
  } catch (error) {
    console.error(error);
    await sleep(idleDelayMs);
  }
}

async function getRunnableJob() {
  const params = [];
  let regionClause = "";
  if (workerRegionIds.length) {
    params.push(workerRegionIds);
    regionClause = `and j.region_id = any($${params.length}::text[])`;
  }
  let yearsBackClause = "";
  if (workerYearsBack.length) {
    params.push(workerYearsBack);
    yearsBackClause = `and j.years_back = any($${params.length}::int[])`;
  }

  const result = await query(`
    select j.*
    from crawl_jobs j
    left join crawl_jobs source on source.id = j.source_job_id
    where j.status in ('requested', 'discovering', 'running')
      and (
        j.source_job_id is null
        or j.status <> 'requested'
        or source.status = 'completed'
      )
      ${regionClause}
      ${yearsBackClause}
    order by
      case
        when j.years_back = 0 then 0
        when j.years_back = 10 then 1
        else 2
      end,
      j.created_at asc
    limit 1
  `, params);
  return result.rows[0] || null;
}

async function discoverJob(job) {
  const region = getRegion(job.region_id);
  if (!region) {
    await updateJob(job.id, {
      status: "failed",
      error_message: `Unknown region: ${job.region_id}`,
      finished_at: new Date()
    });
    return;
  }

  await query(`
    update crawl_jobs
    set status = 'discovering', started_at = coalesce(started_at, now()), updated_at = now()
    where id = $1
  `, [job.id]);
  await log(job.id, "info", `Discovering complexes for ${job.region_id}`);

  try {
    if (job.source_job_id) {
      await queueFromSourceJob(job);
      return;
    }

    const wait = () => politeDelay(job);
    const markers = await provider.fetchComplexesFromTiles(region, job.max_tiles, {
      wait,
      onProgress: (progress) => updateDiscoveryProgress(job.id, progress),
      requireResults: true
    });
    const existingComplexIds = await existingSourceComplexIds(region, {
      requireMonthlyPrices: Number(job.years_back || 0) > 0
    });
    const candidates = dedupeBy(markers, "단지기본일련번호")
      .filter((item) => ["01", "41"].includes(String(item.물건종류 || "")));
    const newCandidates = candidates
      .filter((item) => !existingComplexIds.has(Number(item.단지기본일련번호)));
    const unique = newCandidates.slice(0, job.max_complexes);

    await withClient(async (client) => {
      await client.query("begin");
      try {
        for (const marker of unique) {
          await client.query(`
            insert into crawl_queue (job_id, source_complex_id, marker, status, updated_at)
            values ($1, $2, $3, 'pending', now())
            on conflict (job_id, source_complex_id) do nothing
          `, [job.id, marker.단지기본일련번호, marker]);
        }
        await client.query(`
          update crawl_jobs
          set status = 'running', total_complexes = $2, updated_at = now()
          where id = $1
        `, [job.id, unique.length]);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    });

    await log(job.id, "info", `Discovered ${unique.length} complexes`, {
      discovered: markers.length,
      eligibleDiscovered: candidates.length,
      skippedExisting: candidates.length - newCandidates.length,
      skippedByLimit: newCandidates.length - unique.length,
      selected: unique.length
    });
  } catch (error) {
    await query(`
      update crawl_jobs
      set status = 'failed', error_message = $2, finished_at = now(), updated_at = now()
      where id = $1
    `, [job.id, error.message]);
    await log(job.id, "error", "Discovery failed", { error: error.message });
  }
}

async function queueFromSourceJob(job) {
  const sourceJobResult = await query(`
    select id, status
    from crawl_jobs
    where id = $1
  `, [job.source_job_id]);
  const sourceJob = sourceJobResult.rows[0] || null;
  if (!sourceJob) {
    await updateJob(job.id, {
      status: "failed",
      error_message: `Missing source crawl job: ${job.source_job_id}`,
      finished_at: new Date()
    });
    await log(job.id, "error", `Missing source crawl job ${job.source_job_id}`);
    return;
  }
  if (sourceJob.status === "failed") {
    await updateJob(job.id, {
      status: "failed",
      error_message: `Source crawl job failed: ${job.source_job_id}`,
      finished_at: new Date()
    });
    await log(job.id, "error", `Source crawl job ${job.source_job_id} failed`);
    return;
  }
  if (sourceJob.status !== "completed") {
    await query(`
      update crawl_jobs
      set current_complex_name = $2,
          updated_at = now()
      where id = $1
    `, [job.id, `선행 작업 ${job.source_job_id} 완료 대기`]);
    return;
  }

  const sourceRows = await query(`
    select distinct on (source_complex_id)
      source_complex_id,
      marker
    from crawl_queue
    where job_id = $1
      and status = 'completed'
    order by source_complex_id, id
  `, [job.source_job_id]);
  const existingPriceRows = Number(job.years_back || 0) > 0
    ? await existingApartmentsForPriceRefresh(job.region_id)
    : { rows: [] };

  const candidates = Number(job.years_back || 0) > 0
    ? existingPriceRows.rows
    : sourceRows.rows;
  const selected = dedupeBy(candidates, "source_complex_id")
    .slice(0, Number(job.max_complexes || candidates.length));
  if (!selected.length) {
    await updateJob(job.id, {
      status: "failed",
      error_message: `No regional complexes available after source crawl job: ${job.source_job_id}`,
      finished_at: new Date()
    });
    await log(job.id, "error", `No regional complexes available after source crawl job ${job.source_job_id}`);
    return;
  }

  await withClient(async (client) => {
    await client.query("begin");
    try {
      for (const row of selected) {
        await client.query(`
          insert into crawl_queue (job_id, source_complex_id, marker, status, updated_at)
          values ($1, $2, $3, 'pending', now())
          on conflict (job_id, source_complex_id) do nothing
        `, [job.id, row.source_complex_id, row.marker]);
      }
      await client.query(`
        update crawl_jobs
        set status = 'running', total_complexes = $2, updated_at = now()
        where id = $1
      `, [job.id, selected.length]);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });

  await log(job.id, "info", `Queued ${selected.length} complexes from source job ${job.source_job_id}`, {
    sourceJobId: Number(job.source_job_id),
    sourceQueueRows: sourceRows.rows.length,
    existingPriceRows: existingPriceRows.rows.length,
    selected: selected.length
  });
}

async function existingApartmentsForPriceRefresh(regionId) {
  const region = getRegion(regionId);
  const prefixes = legalDongCodePrefixes(region);
  const result = await query(`
    select distinct on (a.source_complex_id)
      a.source_complex_id,
      jsonb_build_object(
        '단지기본일련번호', a.source_complex_id,
        '단지명', a.name,
        '읍면동명', coalesce(a.neighborhood_name, ''),
        '법정동코드', coalesce(a.legal_dong_code, '')
      ) as marker
    from apartments a
    where (
        (cardinality($2::text[]) = 0 and a.region_id = $1)
        or exists (
          select 1
          from unnest($2::text[]) prefix
          where coalesce(a.legal_dong_code, '') like prefix || '%'
        )
      )
      and a.source_complex_id is not null
    order by a.source_complex_id, a.updated_at desc
  `, [regionId, prefixes]);
  return result;
}

async function existingSourceComplexIds(region, { requireMonthlyPrices = false } = {}) {
  const apartmentConditions = [];
  const queueRegionClause = region.dedupeAgainstAllRegions ? "" : "and j.region_id = $1";
  const params = region.dedupeAgainstAllRegions ? [] : [region.id];
  if (!region.dedupeAgainstAllRegions) {
    apartmentConditions.push("region_id = $1");
  }
  if (requireMonthlyPrices) {
    apartmentConditions.push(`
      exists (
        select 1
        from area_types at
        join monthly_prices mp on mp.area_type_id = at.id
        where at.apartment_id = apartments.id
      )
    `);
  }
  const apartmentWhereClause = apartmentConditions.length
    ? `where ${apartmentConditions.join(" and ")}`
    : "";
  const completedQueueClause = requireMonthlyPrices
    ? "(q.status = 'completed' and j.years_back > 0)"
    : "q.status = 'completed'";
  const result = await query(`
    select source_complex_id
    from apartments
    ${apartmentWhereClause}
    union
    select q.source_complex_id
    from crawl_queue q
    join crawl_jobs j on j.id = q.job_id
    where (
      ${completedQueueClause}
      or j.status in ('discovering', 'running')
      or (j.status = 'requested' and j.years_back = 0)
    )
    ${queueRegionClause}
  `, params);
  return new Set(result.rows.map((row) => Number(row.source_complex_id)));
}

async function recoverStaleRunningItems() {
  if (!Number.isFinite(staleRunningMinutes) || staleRunningMinutes <= 0) return;

  const params = [staleRunningMinutes];
  let regionClause = "";
  if (workerRegionIds.length) {
    params.push(workerRegionIds);
    regionClause = `and j.region_id = any($${params.length}::text[])`;
  }
  let yearsBackClause = "";
  if (workerYearsBack.length) {
    params.push(workerYearsBack);
    yearsBackClause = `and j.years_back = any($${params.length}::int[])`;
  }

  const result = await query(`
    with stale as (
      select q.id, q.job_id
      from crawl_queue q
      join crawl_jobs j on j.id = q.job_id
      where q.status = 'running'
        and j.status = 'running'
        and q.started_at < now() - ($1::int * interval '1 minute')
        ${regionClause}
        ${yearsBackClause}
      limit 50
    ),
    recovered as (
      update crawl_queue q
      set status = 'pending',
          error_message = coalesce(q.error_message, 'Recovered stale running item'),
          updated_at = now()
      from stale
      where q.id = stale.id
      returning stale.job_id
    )
    select job_id, count(*)::int as count
    from recovered
    group by job_id
  `, params);

  for (const row of result.rows) {
    await log(row.job_id, "warn", `Recovered ${row.count} stale running crawl item(s)`, {
      staleRunningMinutes
    });
  }
}

async function processNextQueueItem(job) {
  const claimed = await withClient(async (client) => {
    await client.query("begin");
    try {
      const result = await client.query(`
        select *
        from crawl_queue
        where job_id = $1 and status = 'pending'
        order by id asc
        for update skip locked
        limit 1
      `, [job.id]);
      const item = result.rows[0];
      if (!item) {
        await client.query("commit");
        return null;
      }
      await client.query(`
        update crawl_queue
        set status = 'running', attempts = attempts + 1, started_at = now(), updated_at = now()
        where id = $1
      `, [item.id]);
      await client.query(`
        update crawl_jobs
        set current_complex_id = $2, current_complex_name = $3, updated_at = now()
        where id = $1
      `, [job.id, item.source_complex_id, item.marker?.단지명 || ""]);
      await client.query("commit");
      return item;
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });

  if (!claimed) return false;

  try {
    await log(job.id, "info", `Collecting ${claimed.marker?.단지명 || claimed.source_complex_id}`);
    const region = getRegion(job.region_id);
    const yearsBack = Number(job.years_back || 0);
    const collectHistoricalPrices = yearsBack > 0;
    const sinceYear = collectHistoricalPrices
      ? new Date().getFullYear() - yearsBack
      : Number.POSITIVE_INFINITY;
    const collected = await provider.collectComplex(job.region_id, claimed.marker, {
      maxAreaTypesPerComplex: job.max_area_types_per_complex,
      sinceYear,
      collectHistoricalPrices,
      wait: () => politeDelay(job)
    });

    const filtered = filterCollectedDataForRegion(collected, region);
    await upsertCollectedData(filtered);
    await query(`
      update crawl_queue
      set status = 'completed', completed_at = now(), updated_at = now()
      where id = $1
    `, [claimed.id]);
    await query(`
      update crawl_jobs
      set completed_complexes = completed_complexes + 1, updated_at = now()
      where id = $1
    `, [job.id]);
    await log(job.id, "info", `Completed ${claimed.marker?.단지명 || claimed.source_complex_id}`, {
      apartments: filtered.apartments.length,
      areaTypes: filtered.areaTypes.length,
      monthlyPrices: filtered.monthlyPrices.length,
      skippedByRegionFilter: collected.apartments.length - filtered.apartments.length
    });
  } catch (error) {
    const attempt = Number(claimed.attempts || 0) + 1;
    const exhausted = attempt >= workerMaxItemAttempts;
    await query(`
      update crawl_queue
      set status = $2,
          error_message = $3,
          started_at = case when $2 = 'pending' then null else started_at end,
          updated_at = now()
      where id = $1
    `, [claimed.id, exhausted ? "failed" : "pending", error.message]);
    if (exhausted) {
      await query(`
        update crawl_jobs
        set failed_complexes = failed_complexes + 1, updated_at = now()
        where id = $1
      `, [job.id]);
    }
    await log(
      job.id,
      exhausted ? "error" : "warn",
      `${exhausted ? "Failed" : "Retrying"} ${claimed.marker?.단지명 || claimed.source_complex_id}`,
      {
        error: error.message,
        attempt,
        maxAttempts: workerMaxItemAttempts
      }
    );
  }

  await politeDelay(job);
  return true;
}

function filterCollectedDataForRegion(collected, region) {
  const prefixes = legalDongCodePrefixes(region);
  if (!prefixes.length) return collected;

  const apartments = collected.apartments.filter((apartment) =>
    legalDongCodeMatchesRegion(region, apartment.legalDongCode)
  );
  const apartmentIds = new Set(apartments.map((apartment) => apartment.id));
  const areaTypes = collected.areaTypes.filter((areaType) => apartmentIds.has(areaType.apartmentId));
  const areaTypeIds = new Set(areaTypes.map((areaType) => areaType.id));
  const monthlyPrices = collected.monthlyPrices.filter((price) => areaTypeIds.has(price.areaTypeId));

  return {
    apartments,
    areaTypes,
    monthlyPrices
  };
}

async function updateDiscoveryProgress(jobId, progress) {
  await query(`
    update crawl_jobs
    set current_complex_name = $2,
        updated_at = now()
    where id = $1 and status = 'discovering'
  `, [
    jobId,
    `단지 탐색 ${progress.current}/${progress.total} 타일, 발견 ${progress.found}개`
  ]);
}

async function finishIfDone(job) {
  const jobId = job.id;
  const result = await query(`
    select
      count(*) filter (where status = 'pending')::int as pending,
      count(*) filter (where status = 'running')::int as running,
      count(*) filter (where status = 'failed')::int as failed
    from crawl_queue
    where job_id = $1
  `, [jobId]);
  const row = result.rows[0];
  if (row.pending === 0 && row.running === 0) {
    if (row.failed > 0) {
      await query(`
        update crawl_jobs
        set status = 'failed',
            failed_complexes = $2,
            current_complex_id = null,
            current_complex_name = null,
            error_message = $3,
            finished_at = now(),
            updated_at = now()
        where id = $1 and status = 'running'
      `, [jobId, row.failed, `${row.failed} crawl item(s) failed after retries`]);
      await log(jobId, "error", "Crawl job failed with exhausted queue items", {
        failed: row.failed,
        maxAttempts: workerMaxItemAttempts
      });
      return;
    }
    await query(`
      update crawl_jobs
      set status = 'completed',
          current_complex_id = null,
          current_complex_name = null,
          finished_at = now(),
          updated_at = now()
      where id = $1 and status = 'running'
    `, [jobId]);
    await log(jobId, "info", "Crawl job completed");
    if (shouldRefreshMapCache(job)) {
      await refreshMapCacheAfterJob(jobId);
    } else {
      await log(jobId, "info", "Map growth cache refresh skipped by worker configuration", {
        yearsBack: Number(job.years_back || 0),
        enabled: workerRefreshMapCacheEnabled,
        configuredYearsBack: workerRefreshMapCacheYearsBack
      });
    }
  }
}

function shouldRefreshMapCache(job) {
  return workerRefreshMapCacheEnabled && (
    !workerRefreshMapCacheYearsBack.length
    || workerRefreshMapCacheYearsBack.includes(Number(job.years_back || 0))
  );
}

async function refreshMapCacheAfterJob(jobId) {
  try {
    await log(jobId, "info", "Refreshing map growth cache");
    const result = await refreshMapGrowthCacheIfUnlocked();
    if (result.skipped) {
      await log(jobId, "info", "Map growth cache refresh skipped", {
        reason: result.reason
      });
      return;
    }
    await log(jobId, "info", "Map growth cache refreshed", {
      snapshots: (result.snapshots || []).length,
      refreshedAt: result.refreshedAt
    });
  } catch (error) {
    console.error(error);
    await log(jobId, "error", "Map growth cache refresh failed", {
      error: error.message
    });
  }
}

async function updateJob(jobId, fields) {
  const entries = Object.entries(fields);
  const sets = entries.map(([key], index) => `${key} = $${index + 2}`).join(", ");
  await query(`update crawl_jobs set ${sets}, updated_at = now() where id = $1`, [
    jobId,
    ...entries.map(([, value]) => value)
  ]);
}

async function log(jobId, level, message, details = null) {
  await query(`
    insert into crawl_logs (job_id, level, message, details)
    values ($1, $2, $3, $4)
  `, [jobId, level, message, details]);
  console.log(`[${level}] ${message}`);
}

function politeDelay(job) {
  const min = Number(job.delay_min_ms || 15000);
  const max = Number(job.delay_max_ms || 60000);
  const delay = min + Math.floor(Math.random() * Math.max(1, max - min));
  return sleep(delay);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseWorkerRegionIds(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNumberList(value) {
  return value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));
}

function booleanValue(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  return !["0", "false", "no", "off"].includes(String(value).toLowerCase());
}

function dedupeBy(items, key) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const value = item[key];
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(item);
  }
  return result;
}
