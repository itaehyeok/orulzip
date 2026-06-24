import { closeDb, initDb } from "../src/services/db.js";
import {
  readRebApartmentHouseholdCoverage,
  refreshRebApartmentIdentityMatches,
  syncRebApartmentIdentity
} from "../src/services/reb-apartment-identity-store.js";

const options = parseArgs(process.argv.slice(2));

await initDb();
try {
  const result = options.matchOnly
    ? {
      mode: "match-only",
      matches: await refreshRebApartmentIdentityMatches({ skipIfEmpty: true }),
      coverage: await readRebApartmentHouseholdCoverage()
    }
    : await syncRebApartmentIdentity({
      perPage: options.perPage,
      maxPages: options.maxPages,
      deleteStale: !options.keepStale,
      refreshMatches: !options.skipMatchRefresh,
      delayMs: options.delayMs
    });

  console.log(JSON.stringify(result, null, 2));
} finally {
  await closeDb();
}

function parseArgs(args) {
  const parsed = {
    perPage: 1000,
    maxPages: 0,
    delayMs: 0,
    keepStale: false,
    skipMatchRefresh: false,
    matchOnly: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--per-page") parsed.perPage = Number(args[++index] || parsed.perPage);
    else if (arg.startsWith("--per-page=")) parsed.perPage = Number(arg.slice("--per-page=".length) || parsed.perPage);
    else if (arg === "--max-pages") parsed.maxPages = Number(args[++index] || 0);
    else if (arg.startsWith("--max-pages=")) parsed.maxPages = Number(arg.slice("--max-pages=".length) || 0);
    else if (arg === "--delay-ms") parsed.delayMs = Number(args[++index] || 0);
    else if (arg.startsWith("--delay-ms=")) parsed.delayMs = Number(arg.slice("--delay-ms=".length) || 0);
    else if (arg === "--keep-stale") parsed.keepStale = true;
    else if (arg === "--skip-match-refresh") parsed.skipMatchRefresh = true;
    else if (arg === "--match-only") parsed.matchOnly = true;
  }

  return parsed;
}
