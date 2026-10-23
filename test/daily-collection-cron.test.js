import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const installer = fileURLToPath(new URL("../scripts/install-daily-collection-cron.sh", import.meta.url));
test("cron install replaces marked schedules and is idempotent", () => {
  const dir = mkdtempSync(join(tmpdir(), "daily-cron-"));
  try {
    const tab = join(dir, "tab"), fake = join(dir, "crontab");
    writeFileSync(tab, [
      "15 4 * * * /opt/other-job.sh",
      "0 1 * * * /old/run-molit-national-batch.sh # orulzip molit-national-batch",
      "@reboot /old/run-molit-national-batch.sh # orulzip molit-national-batch",
      "0 2 * * * /old/run-daily-collection.sh molit # orulzip daily-collection molit"
    ].join("\n") + "\n");
    writeFileSync(fake, "#!/usr/bin/env bash\nif [[ \"$1\" == \"-l\" ]]; then cat \"$FAKE_TAB\"; else cat > \"$FAKE_TAB\"; fi\n"); chmodSync(fake, 0o755);
    const env = { ...process.env, CRONTAB_BIN: fake, FAKE_TAB: tab };
    for (let i = 0; i < 2; i++) { const r = spawnSync("bash", [installer], { encoding: "utf8", env }); assert.equal(r.status, 0, r.stderr); }
    const installed = readFileSync(tab, "utf8");
    assert.equal((installed.match(/orulzip daily-collection/g) || []).length, 2);
    assert.equal((installed.match(/orulzip molit-national-batch/g) || []).length, 0);
    assert.match(installed, /^15 4 \* \* \* \/opt\/other-job\.sh$/m);
    assert.match(installed, /^0 2 \* \* \* .*run-daily-collection\.sh molit/m);
    assert.match(installed, /^0 5 \* \* \* .*run-daily-collection\.sh kb/m);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
