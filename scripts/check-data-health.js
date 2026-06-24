import { closeDb, initDb } from "../src/services/db.js";
import { runDataHealthCheck } from "../src/services/data-health.js";

const options = parseArgs(process.argv.slice(2));

await initDb();
try {
  const result = await runDataHealthCheck({
    environment: options.environment,
    notify: options.notify,
    save: !options.noSave
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.status === "fail") process.exitCode = 2;
  if (result.status === "warn" && options.strictWarnings) process.exitCode = 3;
} finally {
  await closeDb();
}

function parseArgs(args) {
  const environmentArg = args.find((arg) => arg.startsWith("--environment="));
  return {
    environment: environmentArg
      ? environmentArg.slice("--environment=".length)
      : process.env.ORULZIP_ENVIRONMENT || process.env.NODE_ENV || "unknown",
    notify: !args.includes("--no-notify"),
    noSave: args.includes("--no-save"),
    strictWarnings: args.includes("--strict-warnings")
  };
}
