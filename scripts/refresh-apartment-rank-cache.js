import { refreshApartmentRankCache, DEFAULT_APARTMENT_RANK_PERIOD_MONTHS } from "../src/services/apartment-rank-cache.js";
import { closeDb, initDb } from "../src/services/db.js";

const options = parseArgs(process.argv.slice(2));

await initDb();
try {
  const result = await refreshApartmentRankCache({
    periodMonths: options.months.length ? options.months : DEFAULT_APARTMENT_RANK_PERIOD_MONTHS
  });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await closeDb();
}

function parseArgs(args) {
  const monthsArg = args.find((arg) => arg.startsWith("--months="));
  return {
    months: monthsArg
      ? monthsArg.slice("--months=".length).split(",").map(Number).filter(Number.isFinite)
      : []
  };
}
