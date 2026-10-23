import { spawn } from "node:child_process";
import { withCollectionRun, normalizeProvider } from "../src/services/collection-run-store.js";
const [providerArg, ...childArgs] = process.argv.slice(2);
const provider = normalizeProvider(providerArg);
const scripts = { molit: "scripts/run-molit-daily-cycle.js", kb: "scripts/run-kb-daily-cycle.js" };
try {
  const result = await withCollectionRun(provider, () => runChild(scripts[provider], childArgs));
  if (result.skipped) console.log(JSON.stringify({ message: "Daily collection skipped; provider lock is held", provider }));
  else console.log(JSON.stringify({ message: "Daily collection finished", provider, runId: result.runId, ...result.summary }));
} catch (error) {
  console.error(JSON.stringify({ message: "Daily collection failed", provider, error: String(error?.message || "Collection process failed.").slice(0, 1000) }));
  process.exitCode = 1;
}
function runChild(script, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: process.cwd(), env: { ...process.env, ORULZIP_DB_INIT: "0" }, stdio: "inherit"
    });
    child.once("error", (error) => {
      const failure = new Error(error.code ? `Unable to start collection child (code ${error.code}).` : "Unable to start collection child.");
      failure.summary = { childScript: script, launchErrorCode: error.code || null }; reject(failure);
    });
    child.once("close", (code, signal) => {
      const summary = { childScript: script, exitCode: code, signal: signal || null };
      if (code === 0) return resolve({ summary });
      const failure = new Error(signal ? `Collection child stopped by signal ${signal}.` : `Collection child exited with status ${code ?? "unknown"}.`);
      failure.summary = summary; reject(failure);
    });
  });
}
