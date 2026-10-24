import { closeDb, initDb } from "../src/services/db.js";
import { runDataHealthCheck } from "../src/services/data-health.js";

const options = parseArgs(process.argv.slice(2));

await initDb();
try {
  const result = await runDataHealthCheck({
    environment: options.environment,
    notify: options.notify,
    save: !options.noSave,
    notificationLabel: options.notificationLabel,
    notificationTestId: options.notificationTestId,
    requireNotification: options.requireNotification
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.status === "fail") process.exitCode = 2;
  if (result.status === "warn" && options.strictWarnings) process.exitCode = 3;
  if (options.requireNotification && !result.telegram?.sent && !process.exitCode) process.exitCode = 4;
} finally {
  await closeDb();
}

function getOption(args, name) {
  const value = args.find((arg) => arg.startsWith(`${name}=`));
  return value ? value.slice(name.length + 1) : undefined;
}

function parseArgs(args) {
  const environmentArg = args.find((arg) => arg.startsWith("--environment="));
  return {
    environment: environmentArg
      ? environmentArg.slice("--environment=".length)
      : process.env.ORULZIP_ENVIRONMENT || process.env.NODE_ENV || "unknown",
    notify: args.includes("--require-notification") || !args.includes("--no-notify"),
    requireNotification: args.includes("--require-notification"),
    notificationLabel: getOption(args, "--notification-label"),
    notificationTestId: getOption(args, "--notification-test-id"),
    noSave: args.includes("--no-save"),
    strictWarnings: args.includes("--strict-warnings")
  };
}
