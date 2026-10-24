import { spawn } from "node:child_process";
import { withCollectionRun, normalizeProvider } from "../src/services/collection-run-store.js";
const [providerArg, ...childArgs] = process.argv.slice(2);
const provider = normalizeProvider(providerArg);
const scripts = { molit: "scripts/run-molit-daily-cycle.js", kb: "scripts/run-kb-daily-cycle.js" };
const testArg = childArgs.find((arg) => arg.startsWith("--notification-test="));
if (testArg) {
  try {
    if (provider !== "molit" || childArgs.length !== 1) throw new Error("Notification tests require molit and exactly one --notification-test=ID argument.");
    await runChild("scripts/verify-collection-notification.js", [testArg.slice("--notification-test=".length)]);
  } catch (error) {
    console.error(JSON.stringify({message:"Collection notification test failed",error:error.message}));
    process.exitCode = 1;
  }
} else {
  await runDaily();
}
async function runDaily() {
  let skipped = false;
  let succeeded = false;
  let runId = "";
  try {
    const result = await withCollectionRun(provider, () => runChild(scripts[provider], childArgs));
    skipped = result.skipped;
    if (result.skipped) console.log(JSON.stringify({ message: "Daily collection skipped; provider lock is held", provider }));
    else {
      succeeded = true; runId = result.runId;
      console.log(JSON.stringify({ message: "Daily collection finished", provider, runId, ...result.summary }));
    }
  } catch (error) {
    console.error(JSON.stringify({ message: "Daily collection failed", provider, error: String(error?.message || "Collection process failed.").slice(0, 1000) }));
    process.exitCode = 1;
  } finally {
    // Notify once, after the provider history is finalized and overall health is known.
    if (!skipped) {
      const label = (provider === "molit" ? "실거래" : "KB") + " 일일 수집 " + (succeeded ? "완료" : "실패") + (runId ? " (#" + runId + ")" : "");
      try { await runChild("scripts/check-data-health.js", ["--notification-label=" + label, "--require-notification"]); }
      catch {
        console.error(JSON.stringify({message:"Overall collection health or Telegram notification failed; inspect the saved health result",provider}));
        process.exitCode = 1;
      }
    }
  }
}
function runChild(script, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: process.cwd(), env: { ...process.env, ORULZIP_DB_INIT: "0" }, stdio: "inherit"
    });
    child.once("error", (error) => {
      const failure = new Error(error.code ? "Unable to start collection child (code " + error.code + ")." : "Unable to start collection child.");
      failure.summary = { childScript: script, launchErrorCode: error.code || null }; reject(failure);
    });
    child.once("close", (code, signal) => {
      const summary = { childScript: script, exitCode: code, signal: signal || null };
      if (code === 0) return resolve({ summary });
      const failure = new Error(signal ? "Collection child stopped by signal " + signal + "." : "Collection child exited with status " + (code ?? "unknown") + ".");
      failure.summary = summary; reject(failure);
    });
  });
}
