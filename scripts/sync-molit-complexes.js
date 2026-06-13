import { initDb } from "../src/services/db.js";
import { syncMolitComplexes } from "../src/services/molit-complex-store.js";

const options = parseArgs(process.argv.slice(2));

await initDb();

const result = await syncMolitComplexes({
  geocode: options.geocode,
  geocodeMode: options.geocodeMode,
  geocodeLimit: options.geocodeLimit,
  overwriteGeocode: options.overwriteGeocode
});

console.log(JSON.stringify(result, null, 2));

function parseArgs(args) {
  const parsed = {
    geocode: false,
    geocodeMode: "missing",
    geocodeLimit: 0,
    overwriteGeocode: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--geocode") parsed.geocode = true;
    else if (arg === "--geocode-mode") parsed.geocodeMode = args[++index] || parsed.geocodeMode;
    else if (arg.startsWith("--geocode-mode=")) parsed.geocodeMode = arg.split("=").slice(1).join("=") || parsed.geocodeMode;
    else if (arg === "--geocode-limit") parsed.geocodeLimit = Number(args[++index] || 0);
    else if (arg.startsWith("--geocode-limit=")) parsed.geocodeLimit = Number(arg.split("=").slice(1).join("=") || 0);
    else if (arg === "--overwrite-geocode") parsed.overwriteGeocode = true;
  }

  if (!["missing", "matched", "all"].includes(parsed.geocodeMode)) {
    throw new Error("--geocode-mode must be one of: missing, matched, all");
  }

  return parsed;
}
