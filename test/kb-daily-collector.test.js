import test from "node:test";
import assert from "node:assert/strict";
import { kstMonth,priceWindow,normalizeFetchedPrices,requestPacer,parseKbDailyArgs } from "../src/services/kb-daily-collector.js";

test("KST month rollover and year window fill stale KB months", () => {
  assert.equal(kstMonth(new Date("2026-10-31T15:00:00Z")),"202611");
  assert.deepEqual(priceWindow("202606","202610"),{startMonth:"202606",endMonth:"202610",years:["2026"]});
  assert.deepEqual(priceWindow("202512","202602"),{startMonth:"202512",endMonth:"202602",years:["2025","2026"]});
});
test("daily KB normalizes, bounds and deduplicates actual provider prices", () => {
  const area={id:"kb:1:area:1",supply_area_pyeong:30,exclusive_area_pyeong:25};
  const group=[{items:[{기준년월:"202610",매매일반거래가:30000},{기준년월:"202610",매매일반거래가:33000},
    {기준년월:"202607",매매일반거래가:30000},{기준년월:"202611",매매일반거래가:30000},
    {기준년월:"202609",매매일반거래가:0}]}];
  const rows=normalizeFetchedPrices(area,group,priceWindow("202610","202610"));
  assert.equal(rows.length,1);
  assert.equal(rows[0].yearMonth,"202610");
  assert.equal(rows[0].pyeongPrice,1100);
});
test("request pacing reserves separate slots for concurrent requests", async () => {
  const sleeps=[];
  const pace=requestPacer(250,{now:()=>1000,sleep:async(ms)=>{sleeps.push(ms);}});
  await Promise.all([pace(),pace(),pace()]);
  assert.deepEqual(sleeps,[250,500]);
});

test("a malformed KB limit never expands to an unlimited collection", () => {
  for (const args of [["--limit"],["--limit","-1"],["--limit","abc"],["--limit=0"],["--limit","2","--limit","3"],["--oops"]]) {
    assert.throws(() => parseKbDailyArgs(args,{}));
  }
  assert.equal(parseKbDailyArgs(["--limit=5"],{}).limit,5);
  assert.equal(parseKbDailyArgs([],{}).limit,0);
  assert.equal(parseKbDailyArgs(["--force"],{}).resume,false);
  assert.throws(() => parseKbDailyArgs([],{KB_DAILY_CONCURRENCY:"NaN"}));
});
