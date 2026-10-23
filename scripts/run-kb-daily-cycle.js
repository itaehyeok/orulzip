import { spawnSync } from "node:child_process";
import { closeDb } from "../src/services/db.js";
import { runKbDailyCollection, parseKbDailyArgs } from "../src/services/kb-daily-collector.js";

try {
  const result = await runKbDailyCollection(parseKbDailyArgs(process.argv.slice(2)));
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
