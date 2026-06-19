import { closeDb, initAnalyticsDb } from "../src/services/db.js";

try {
  await initAnalyticsDb();
  console.log(JSON.stringify({ ok: true, migrated: "analytics" }, null, 2));
} finally {
  await closeDb();
}
