import { initDb } from "../src/services/db.js";
import { MolitTradeProvider } from "../src/providers/molit-trade-provider.js";
import {
  completedFetchSet,
  fetchKey,
  latestKbPricePeriod,
  markTradeFetchCompleted,
  markTradeFetchFailed,
  markTradeFetchStarted,
  tradeCollectionSummary,
  upsertTradeDeals
} from "../src/services/molit-trade-store.js";

const SEOUL_LAWD_CODES = [
  ["11110", "서울 종로구"],
  ["11140", "서울 중구"],
  ["11170", "서울 용산구"],
  ["11200", "서울 성동구"],
  ["11215", "서울 광진구"],
  ["11230", "서울 동대문구"],
  ["11260", "서울 중랑구"],
  ["11290", "서울 성북구"],
  ["11305", "서울 강북구"],
  ["11320", "서울 도봉구"],
  ["11350", "서울 노원구"],
  ["11380", "서울 은평구"],
  ["11410", "서울 서대문구"],
  ["11440", "서울 마포구"],
  ["11470", "서울 양천구"],
  ["11500", "서울 강서구"],
  ["11530", "서울 구로구"],
  ["11545", "서울 금천구"],
  ["11560", "서울 영등포구"],
  ["11590", "서울 동작구"],
  ["11620", "서울 관악구"],
  ["11650", "서울 서초구"],
  ["11680", "서울 강남구"],
  ["11710", "서울 송파구"],
  ["11740", "서울 강동구"]
];

const DONGTAN_LEGAL_DONGS = new Set([
  "반송동",
  "석우동",
  "능동",
  "청계동",
  "영천동",
  "오산동",
  "방교동",
  "산척동",
  "송동",
  "목동",
  "장지동",
  "신동",
  "중동"
]);

const TARGETS = {
  seoul: {
    id: "seoul",
    lawdCodes: SEOUL_LAWD_CODES.map(([lawdCd, lawdName]) => ({ lawdCd, lawdName }))
  },
  bundang: {
    id: "bundang",
    lawdCodes: [{ lawdCd: "41135", lawdName: "성남시 분당구" }]
  },
  dongtan: {
    id: "dongtan",
    // MOLIT apartment trade API is queried by 시군구 5-digit code. Dongtan is filtered from Hwaseong rows by legal dong.
    lawdCodes: [{ lawdCd: "41590", lawdName: "화성시" }],
    filter: (deal) => DONGTAN_LEGAL_DONGS.has(String(deal.umdNm || deal.법정동 || "").trim())
  }
};

const options = parseArgs(process.argv.slice(2));

await initDb();
const kbPeriod = await latestKbPricePeriod();
const startMonth = options.start || kbPeriod.startMonth || "201601";
const endMonth = options.end || kbPeriod.endMonth || currentYearMonth();
const targetIds = options.targets.split(",").map((item) => item.trim()).filter(Boolean);
const provider = new MolitTradeProvider({
  serviceKey: process.env.MOLIT_APT_TRADE_SERVICE_KEY,
  numOfRows: options.numRows
});

const tasks = buildTasks({ targetIds, startMonth, endMonth });

if (options.plan || !process.env.MOLIT_APT_TRADE_SERVICE_KEY) {
  console.log(JSON.stringify({
    mode: options.plan ? "plan" : "missing-api-key",
    message: process.env.MOLIT_APT_TRADE_SERVICE_KEY
      ? "Plan only. Remove --plan to collect."
      : "Set MOLIT_APT_TRADE_SERVICE_KEY in .env or pass it to docker compose run before collecting.",
    period: { startMonth, endMonth },
    targets: targetIds,
    taskCount: tasks.length,
    estimatedRequests: tasks.length,
    dailyLimit: options.limit,
    summary: await tradeCollectionSummary()
  }, null, 2));
  process.exit(options.plan || process.env.MOLIT_APT_TRADE_SERVICE_KEY ? 0 : 2);
}

const completed = await completedFetchSet();
const runnable = tasks
  .filter((task) => options.force || !completed.has(fetchKey(task.target.id, task.lawdCd, task.yearMonth)))
  .slice(0, options.limit);

console.log(JSON.stringify({
  message: "Starting MOLIT apartment trade collection",
  period: { startMonth, endMonth },
  targets: targetIds,
  totalTasks: tasks.length,
  runnableTasks: runnable.length,
  dailyLimit: options.limit
}, null, 2));

let completedCount = 0;
let failedCount = 0;
let savedDeals = 0;

for (const task of runnable) {
  await markTradeFetchStarted({
    targetRegionId: task.target.id,
    lawdCd: task.lawdCd,
    lawdName: task.lawdName,
    yearMonth: task.yearMonth
  });

  try {
    const result = await provider.fetchDeals({
      lawdCd: task.lawdCd,
      yearMonth: task.yearMonth
    });
    const deals = task.target.filter ? result.items.filter(task.target.filter) : result.items;
    const filteredCount = result.items.length - deals.length;
    const savedCount = await upsertTradeDeals({
      targetRegionId: task.target.id,
      lawdCd: task.lawdCd,
      yearMonth: task.yearMonth,
      deals
    });
    await markTradeFetchCompleted({
      targetRegionId: task.target.id,
      lawdCd: task.lawdCd,
      yearMonth: task.yearMonth,
      totalCount: result.totalCount,
      fetchedCount: result.items.length,
      savedCount,
      filteredCount,
      pageCount: result.pageCount
    });
    completedCount += 1;
    savedDeals += savedCount;
    console.log(`[molit] completed ${task.target.id} ${task.lawdName} ${task.yearMonth}: fetched=${result.items.length} saved=${savedCount} filtered=${filteredCount}`);
  } catch (error) {
    failedCount += 1;
    await markTradeFetchFailed({
      targetRegionId: task.target.id,
      lawdCd: task.lawdCd,
      yearMonth: task.yearMonth,
      error
    });
    console.error(`[molit] failed ${task.target.id} ${task.lawdName} ${task.yearMonth}: ${error.message}`);
  }

  if (options.delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, options.delayMs));
  }
}

console.log(JSON.stringify({
  message: "MOLIT collection finished",
  completedTasks: completedCount,
  failedTasks: failedCount,
  savedDeals,
  summary: await tradeCollectionSummary()
}, null, 2));

function buildTasks({ targetIds, startMonth, endMonth }) {
  const months = monthRange(startMonth, endMonth);
  const result = [];
  for (const targetId of targetIds) {
    const target = TARGETS[targetId];
    if (!target) throw new Error(`Unknown target: ${targetId}`);
    for (const { lawdCd, lawdName } of target.lawdCodes) {
      for (const yearMonth of months) {
        result.push({ target, lawdCd, lawdName, yearMonth });
      }
    }
  }
  return result;
}

function monthRange(startMonth, endMonth) {
  const months = [];
  let year = Number(startMonth.slice(0, 4));
  let month = Number(startMonth.slice(4, 6));
  const end = Number(endMonth);
  while (Number(`${year}${String(month).padStart(2, "0")}`) <= end) {
    months.push(`${year}${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

function parseArgs(args) {
  const parsed = {
    targets: "seoul,bundang,dongtan",
    start: "",
    end: "",
    limit: 9000,
    delayMs: 250,
    numRows: 1000,
    force: false,
    plan: false
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--targets") parsed.targets = args[++index] || parsed.targets;
    else if (arg === "--start") parsed.start = args[++index] || "";
    else if (arg === "--end") parsed.end = args[++index] || "";
    else if (arg === "--limit") parsed.limit = Number(args[++index] || parsed.limit);
    else if (arg === "--delay-ms") parsed.delayMs = Number(args[++index] || parsed.delayMs);
    else if (arg === "--num-rows") parsed.numRows = Number(args[++index] || parsed.numRows);
    else if (arg === "--force") parsed.force = true;
    else if (arg === "--plan") parsed.plan = true;
  }
  return parsed;
}

function currentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
}
