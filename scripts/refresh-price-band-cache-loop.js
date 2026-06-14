import { initDb, closeDb } from "../src/services/db.js";
import { refreshPriceBandRankCache } from "../src/services/price-band-rank-cache.js";

const intervalMs = positiveNumber(process.env.PRICE_BAND_CACHE_REFRESH_INTERVAL_MS, 24 * 60 * 60 * 1000);
const initialDelayMs = Math.max(0, Number(process.env.PRICE_BAND_CACHE_INITIAL_DELAY_MS || 0));
let stopped = false;

process.on("SIGINT", () => {
  stopped = true;
});
process.on("SIGTERM", () => {
  stopped = true;
});

await initDb();
try {
  if (initialDelayMs > 0) await sleep(initialDelayMs);
  while (!stopped) {
    await refreshOnce();
    if (!stopped) await sleep(intervalMs);
  }
} finally {
  await closeDb();
}

async function refreshOnce() {
  const startedAt = new Date().toISOString();
  try {
    console.log(JSON.stringify({ message: "price band cache refresh started", startedAt }));
    const result = await refreshPriceBandRankCache();
    console.log(JSON.stringify({ message: "price band cache refreshed", ...result }));
  } catch (error) {
    console.error(JSON.stringify({
      message: "price band cache refresh failed",
      startedAt,
      error: error.message
    }));
  }
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
