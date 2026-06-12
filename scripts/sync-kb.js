import { initDb } from "../src/services/db.js";
import { createCrawlJob } from "../src/services/db-store.js";

const regionId = process.argv[2] || "bundang";
const maxComplexes = Number(process.argv[3] || 25);
const yearsBack = Number(process.argv[4] || 10);
const maxAreaTypesPerComplex = Number(process.argv[5] || 2);
const maxTiles = Number(process.argv[6] || 8);

await initDb();
const job = await createCrawlJob({
  regionId,
  maxComplexes,
  yearsBack,
  maxAreaTypesPerComplex,
  maxTiles,
  delayMinMs: Number(process.argv[7] || 15000),
  delayMaxMs: Number(process.argv[8] || 60000)
});

console.log(JSON.stringify({
  message: "Crawl job queued. Run `npm run worker` to collect data.",
  job
}, null, 2));
