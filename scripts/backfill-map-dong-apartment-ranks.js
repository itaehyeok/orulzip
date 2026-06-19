import { closeDb, initDb } from "../src/services/db.js";
import { backfillMapDongApartmentRankItems } from "../src/services/map-growth-cache.js";

const options = parseArgs(process.argv.slice(2));

await initDb();
try {
  const result = await backfillMapDongApartmentRankItems(options);
  console.log(JSON.stringify(result, null, 2));
} finally {
  await closeDb();
}

function parseArgs(args) {
  const sourceArg = args.find((arg) => arg.startsWith("--source="));
  return {
    source: sourceArg ? sourceArg.slice("--source=".length) : "molit",
    onlyMissing: !args.includes("--all")
  };
}
