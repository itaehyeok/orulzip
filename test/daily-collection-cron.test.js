import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const installer = fileURLToPath(new URL("../scripts/install-daily-collection-cron.sh", import.meta.url));

function setup(dir, initialTab = "") {
  const tab = join(dir, "tab");
  const crontab = join(dir, "crontab");
  const fakeBin = join(dir, "fakebin");
  mkdirSync(fakeBin, { recursive: true });
  writeFileSync(tab, initialTab);
  writeFileSync(crontab, "#!/usr/bin/env bash\nif [[ \"$1\" == \"-l\" ]]; then cat \"$FAKE_TAB\"; else cat > \"$FAKE_TAB\"; fi\n");
  chmodSync(crontab, 0o755);
  const cat = join(fakeBin, "cat");
  const date = join(fakeBin, "date");
  writeFileSync(cat, "#!/usr/bin/env bash\nif [[ \"$1\" == \"/etc/timezone\" ]]; then printf \"%s\\n\" \"${FAKE_TIMEZONE:-Asia/Seoul}\"; else exec /bin/cat \"$@\"; fi\n");
  writeFileSync(date, "#!/usr/bin/env bash\nif [[ \"$1\" == \"+%Z%z\" ]]; then printf \"%s\\n\" \"${FAKE_CLOCK_TZ:-KST+0900}\"; else exec /bin/date \"$@\"; fi\n");
  chmodSync(cat, 0o755); chmodSync(date, 0o755);
  return { tab, crontab, fakeBin };
}
function envFor(paths, overrides = {}) {
  return { ...process.env, PATH: `${paths.fakeBin}:${process.env.PATH}`, CRONTAB_BIN: paths.crontab, FAKE_TAB: paths.tab, ...overrides };
}

test("cron install replaces marked schedules and is idempotent", () => {
  const dir = mkdtempSync(join(tmpdir(), "daily-cron-"));
  try {
    const initial = [
      "15 4 * * * /opt/other-job.sh",
      "0 1 * * * /old/run-molit-national-batch.sh # orulzip molit-national-batch",
      "@reboot /old/run-molit-national-batch.sh # orulzip molit-national-batch",
      "0 2 * * * /old/run-daily-collection.sh molit # orulzip daily-collection molit"
    ].join("\n") + "\n";
    const paths = setup(dir, initial);
    const env = envFor(paths);
    for (let i = 0; i < 2; i++) { const result = spawnSync("bash", [installer], { encoding: "utf8", env }); assert.equal(result.status, 0, result.stderr); }
    const installed = readFileSync(paths.tab, "utf8");
    assert.equal((installed.match(/orulzip daily-collection/g) || []).length, 2);
    assert.equal((installed.match(/orulzip molit-national-batch/g) || []).length, 0);
    assert.match(installed, /^15 4 \* \* \* \/opt\/other-job\.sh$/m);
    assert.match(installed, /^0 2 \* \* \* .*run-daily-collection\.sh molit/m);
    assert.match(installed, /^0 5 \* \* \* .*run-daily-collection\.sh kb/m);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("cron installer rejects a non-KST host before changing the crontab", () => {
  const dir = mkdtempSync(join(tmpdir(), "daily-cron-tz-"));
  try {
    const initial = "15 4 * * * /opt/other-job.sh\n";
    const paths = setup(dir, initial);
    const result = spawnSync("bash", [installer], { encoding: "utf8", env: envFor(paths, { FAKE_CLOCK_TZ: "UTC+0000" }) });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /timezone must be Asia\/Seoul/);
    assert.equal(readFileSync(paths.tab, "utf8"), initial);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
