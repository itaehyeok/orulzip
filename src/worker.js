import { KBPriceProvider } from "./providers/kb-price-provider.js";
import { initDb, query, withClient } from "./services/db.js";
import { upsertCollectedData } from "./services/db-store.js";
import { refreshMapGrowthCacheIfUnlocked } from "./services/map-growth-cache.js";
import { getRegion } from "./services/region-config.js";

const provider = new KBPriceProvider();
const idleDelayMs = Number(process.env.WORKER_IDLE_DELAY_MS || 5000);
const workerRegionIds = parseWorkerRegionIds(process.env.WORKER_REGION_IDS || "");

await initDb();
console.log(`KB worker started${workerRegionIds.length ? ` for ${workerRegionIds.join(",")}` : ""}`);

while (true) {
  try {
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
        await finishIfDone(job.id);
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
    regionClause = `and region_id = any($${params.length}::text[])`;
  }

  const result = await query(`
    select *
    from crawl_jobs
    where status in ('requested', 'discovering', 'running')
      ${regionClause}
    order by created_at asc
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
      onProgress: (progress) => updateDiscoveryProgress(job.id, progress)
    });
    const existingComplexIds = await existingSourceComplexIds(region);
    const unique = dedupeBy(markers, "단지기본일련번호")
      .filter((item) => ["01", "41"].includes(String(item.물건종류 || "")))
      .filter((item) => !existingComplexIds.has(Number(item.단지기본일련번호)))
      .slice(0, job.max_complexes);

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
      skippedExisting: existingComplexIds.size,
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
  const sourceRows = await query(`
    select distinct on (source_complex_id)
      source_complex_id,
      marker
    from crawl_queue
    where job_id = $1
    order by source_complex_id, id
  `, [job.source_job_id]);

  const selected = sourceRows.rows.slice(0, Number(job.max_complexes || sourceRows.rows.length));

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
    selected: selected.length
  });
}

async function existingSourceComplexIds(region) {
  const regionClause = region.dedupeAgainstAllRegions ? "" : "where region_id = $1";
  const queueRegionClause = region.dedupeAgainstAllRegions ? "" : "and j.region_id = $1";
  const params = region.dedupeAgainstAllRegions ? [] : [region.id];
  const result = await query(`
    select source_complex_id
    from apartments
    ${regionClause}
    union
    select q.source_complex_id
    from crawl_queue q
    join crawl_jobs j on j.id = q.job_id
    where q.status = 'completed'
    ${queueRegionClause}
  `, params);
  return new Set(result.rows.map((row) => Number(row.source_complex_id)));
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
    const sinceYear = new Date().getFullYear() - Number(job.years_back);
    const collected = await provider.collectComplex(job.region_id, claimed.marker, {
      maxAreaTypesPerComplex: job.max_area_types_per_complex,
      sinceYear,
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
    await query(`
      update crawl_queue
      set status = 'failed', error_message = $2, updated_at = now()
      where id = $1
    `, [claimed.id, error.message]);
    await query(`
      update crawl_jobs
      set failed_complexes = failed_complexes + 1, updated_at = now()
      where id = $1
    `, [job.id]);
    await log(job.id, "error", `Failed ${claimed.marker?.단지명 || claimed.source_complex_id}`, {
      error: error.message
    });
  }

  await politeDelay(job);
  return true;
}

function filterCollectedDataForRegion(collected, region) {
  if (!region?.legalDongCodePrefix) return collected;

  const apartments = collected.apartments.filter((apartment) =>
    String(apartment.legalDongCode || "").startsWith(region.legalDongCodePrefix)
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

async function finishIfDone(jobId) {
  const result = await query(`
    select
      count(*) filter (where status = 'pending')::int as pending,
      count(*) filter (where status = 'running')::int as running
    from crawl_queue
    where job_id = $1
  `, [jobId]);
  const row = result.rows[0];
  if (row.pending === 0 && row.running === 0) {
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
    await refreshMapCacheAfterJob(jobId);
  }
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
