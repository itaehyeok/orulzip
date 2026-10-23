import { spawnSync } from "node:child_process";
import { closeDb } from "../src/services/db.js";
import { runKbDailyCollection } from "../src/services/kb-daily-collector.js";

const args = process.argv.slice(2);
const limitIndex = args.indexOf("--limit");
const options = {
  delayMs: Math.max(100, Number(process.env.KB_DAILY_DELAY_MS || 250)),
  concurrency: Math.max(1, Math.min(8, Number(process.env.KB_DAILY_CONCURRENCY || 3))),
  limit: limitIndex >= 0 ? Number(args[limitIndex + 1]) : 0,
  resume: !args.includes("--force")
};
try {
  const result = await runKbDailyCollection(options);
  if (result.status === "succeeded") {
    for (const task of ["map", "ranking", "overview"]) {
      const child = spawnSync(process.execPath, ["scripts/run-kb-cache-task.js", "--task=" + task],
        {env:{...process.env,ORULZIP_DB_INIT:"0"},stdio:"inherit"});
      if (child.status !== 0) throw new Error("KB cache task failed: " + task);
    }
    result.cacheRefreshed = true;
  }
  console.log(JSON.stringify({ message: "KB daily cycle finished", ...result }, null, 2));
  if (result.status !== "succeeded") process.exitCode = 1;
} catch(error) {
  console.error(JSON.stringify({message:"KB daily cycle failed",error:error.message}));
  process.exitCode = 1;
} finally { await closeDb(); }
