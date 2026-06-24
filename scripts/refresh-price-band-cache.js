import {
  DEFAULT_PRICE_BAND_PERIOD_MONTHS,
  ensurePriceBandRankCacheIndexes,
  refreshPriceBandRankCache
} from "../src/services/price-band-rank-cache.js";
import { closeDb, initDb } from "../src/services/db.js";

const options = parseArgs(process.argv.slice(2));

await initDb();
try {
  await ensurePriceBandRankCacheIndexes();
  const result = await refreshPriceBandRankCache({
    periodMonths: options.months.length ? options.months : DEFAULT_PRICE_BAND_PERIOD_MONTHS,
    areaBandKeys: options.areaBands.length ? options.areaBands : undefined
  });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await closeDb();
}

function parseArgs(args) {
  const monthsArg = args.find((arg) => arg.startsWith("--months="));
  const areaBandsArg = args.find((arg) => arg.startsWith("--area-bands="));
  return {
    months: monthsArg
      ? monthsArg.slice("--months=".length).split(",").map(Number).filter(Number.isFinite)
      : [],
    areaBands: areaBandsArg
      ? areaBandsArg.slice("--area-bands=".length).split(",").map((value) => value.trim()).filter(Boolean)
      : []
  };
}
