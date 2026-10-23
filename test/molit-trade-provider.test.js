import test from "node:test";
import assert from "node:assert/strict";
import { MolitTradeProvider } from "../src/providers/molit-trade-provider.js";
const ok = () => ({ok:true,status:200,text:async()=>"<response><header><resultCode>00</resultCode></header><body><totalCount>0</totalCount><items/></body></response>"});
test("MOLIT retries a transient failure with a bounded request signal", async () => {
 let calls=0;
 const p=new MolitTradeProvider({serviceKey:"test",retryDelayMs:0,request:async(_url,options)=>{
  assert.ok(options.signal instanceof AbortSignal);calls++;
  if(calls===1) throw new TypeError("fetch failed");
  return ok();
 }});
 assert.equal((await p.fetchPage({lawdCd:"11110",yearMonth:"202610",pageNo:1})).totalCount,0);
 assert.equal(calls,2);
});
test("MOLIT quota/auth errors do not waste retries", async () => {
 let calls=0;
 const p=new MolitTradeProvider({serviceKey:"test",retryDelayMs:0,request:async()=>{
  calls++;return {ok:true,status:200,text:async()=>"<response><resultCode>22</resultCode><resultMsg>LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR</resultMsg></response>"};
 }});
 await assert.rejects(p.fetchPage({lawdCd:"11110",yearMonth:"202610",pageNo:1}),/API 22/);
 assert.equal(calls,1);
});
test("MOLIT persistent transient errors stop after three attempts", async () => {
 let calls=0;
 const p=new MolitTradeProvider({serviceKey:"test",retryDelayMs:0,request:async()=>{calls++;throw new TypeError("fetch failed");}});
 await assert.rejects(p.fetchPage({lawdCd:"11110",yearMonth:"202610",pageNo:1}),/fetch failed/);
 assert.equal(calls,3);
});
