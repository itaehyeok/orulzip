import assert from "node:assert/strict";
import test from "node:test";
import { KBPriceProvider } from "../src/providers/kb-price-provider.js";

const region = {
  id: "test",
  bbox: {
    startLat: 0,
    endLat: 0.01,
    startLng: 0,
    endLng: 0.02
  },
  tileSize: 0.01
};

test("retries only failed KB discovery tiles", async () => {
  const calls = new Map();
  const provider = new KBPriceProvider({
    tileRetryPasses: 2,
    request: async (_path, options) => {
      const key = String(options.body.startLng);
      calls.set(key, (calls.get(key) || 0) + 1);
      if (key === "0" && calls.get(key) === 1) throw new Error("temporary failure");
      return {
        dataBody: {
          data: {
            단지리스트: [{ 단지기본일련번호: Number(options.body.startLng * 1000) + 1 }]
          }
        }
      };
    }
  });

  const rows = await provider.fetchComplexesFromTiles(region, 2, { wait: async () => {} });

  assert.equal(rows.length, 2);
  assert.equal(calls.get("0"), 2);
  assert.equal(calls.get("0.01"), 1);
});

test("fails discovery instead of silently accepting missing tiles", async () => {
  const provider = new KBPriceProvider({
    tileRetryPasses: 2,
    request: async () => {
      throw new Error("persistent failure");
    }
  });

  await assert.rejects(
    provider.fetchComplexesFromTiles(region, 2, { wait: async () => {} }),
    (error) => {
      assert.equal(error.code, "KB_TILE_DISCOVERY_INCOMPLETE");
      assert.deepEqual(error.failedTiles, [1, 2]);
      assert.match(error.message, /2\/2 tile\(s\) failed/);
      return true;
    }
  );
});

test("fails required discovery when KB silently returns no complexes", async () => {
  const provider = new KBPriceProvider({
    request: async () => ({
      dataBody: {
        data: {
          단지리스트: []
        }
      }
    })
  });

  await assert.rejects(
    provider.fetchComplexesFromTiles(region, 2, {
      wait: async () => {},
      requireResults: true
    }),
    (error) => {
      assert.equal(error.code, "KB_TILE_DISCOVERY_EMPTY");
      assert.equal(error.tileCount, 2);
      assert.match(error.message, /no complexes across 2 completed tile/);
      return true;
    }
  );
});
