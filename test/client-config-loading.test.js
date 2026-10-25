import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const coreSource = readFileSync(new URL("../src/public/js/app-core.js", import.meta.url), "utf8");
const mapSource = readFileSync(new URL("../src/public/js/app-map.js", import.meta.url), "utf8");
const validConfig = { maps: { provider: "naver", naverKeyId: "test-key", disabled: false } };

function client(fetch) {
  const state = {};
  const context = vm.createContext({ state, fetch, AbortController, Date, setTimeout, clearTimeout, window: {} });
  vm.runInContext(coreSource + "\n" + mapSource, context);
  return { state, context, load: (options = {}) => context.loadClientConfig({ retryDelayMs: 0, ...options }) };
}

function ok(config = validConfig) {
  return { ok: true, json: async () => config };
}

test("retries a transient configuration failure and continues with the real key", async () => {
  let attempts = 0;
  const c = client(async (url, options) => {
    assert.equal(url, "/api/client-config");
    assert.equal(options.cache, "no-store");
    attempts += 1;
    if (attempts === 1) throw new TypeError("Failed to fetch");
    return ok();
  });
  await c.load();
  assert.equal(attempts, 2);
  assert.equal(c.state.clientConfig.maps.naverKeyId, "test-key");
  assert.equal(c.state.clientConfigError, null);
});

test("exhausted failures keep HTTP diagnostics instead of reporting a missing key", async () => {
  let attempts = 0;
  const c = client(async () => { attempts += 1; return { ok: false, status: 503 }; });
  await c.load();
  assert.equal(attempts, 3);
  await assert.rejects(c.context.loadNaverSdk(), { code: "client-config-load-failed" });
  const detail = c.context.naverMapFailureDetail(c.state.clientConfigError);
  assert.match(detail, /HTTP 503/);
  assert.match(detail, /3회/);
  assert.doesNotMatch(detail, /키를 내려주지/);
});

test("slow configuration requests abort and produce a timeout diagnostic", async () => {
  let aborted = 0;
  const c = client((url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener("abort", () => { aborted += 1; reject(new Error("aborted")); });
  }));
  await c.load({ timeoutMs: 5, attempts: 2 });
  assert.equal(aborted, 2);
  assert.match(c.state.clientConfigError.failureDetail, /요청 시간 초과 \(5ms\)/);
});

test("invalid JSON and malformed configuration retry without logging the response body", async () => {
  let attempts = 0;
  const c = client(async () => {
    attempts += 1;
    if (attempts === 1) return { ok: true, json: async () => { throw new SyntaxError("private-response-body"); } };
    return ok({ maps: {} });
  });
  await c.load({ attempts: 2 });
  assert.match(c.state.clientConfigError.failureDetail, /응답 JSON 파싱 실패/);
  assert.match(c.state.clientConfigError.failureDetail, /지도 설정 응답 형식 오류/);
  assert.doesNotMatch(c.state.clientConfigError.failureDetail, /private-response-body/);
});

test("successful empty-key and disabled responses retain their own map error codes", async () => {
  for (const [maps, code] of [
    [{ provider: "naver", naverKeyId: "", disabled: false }, "missing-key"],
    [{ provider: "naver", naverKeyId: "test-key", disabled: true }, "disabled"]
  ]) {
    const c = client(async () => ok({ maps }));
    await c.load();
    assert.equal(c.state.clientConfigError, null);
    await assert.rejects(c.context.loadNaverSdk(), { code });
  }
});

test("a later successful configuration load clears the previous failure", async () => {
  let recovered = false;
  const c = client(async () => { if (!recovered) throw new Error("private-network-detail"); return ok(); });
  await c.load({ attempts: 1 });
  assert.doesNotMatch(c.state.clientConfigError.failureDetail, /private-network-detail/);
  recovered = true;
  await c.load();
  assert.equal(c.state.clientConfigError, null);
  assert.equal(c.state.clientConfig.maps.naverKeyId, "test-key");
});
