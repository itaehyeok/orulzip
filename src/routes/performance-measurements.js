import {
  readPerformanceMeasurementStatus,
  runPerformanceMeasurements
} from "../services/performance-measurements.js";

export const PERFORMANCE_APP_ROUTES = new Set(["/performance"]);
export const PERFORMANCE_PROTECTED_API_ROUTES = new Set([
  "/api/performance-measurements",
  "/api/performance-measurements/run"
]);
export const PERFORMANCE_ROUTE_SEO = new Map([
  ["/performance", {
    title: "성능 측정 - 오를집",
    description: "오를집 지도와 실거래가 랭킹 캐시 응답 속도 측정 화면입니다.",
    canonicalPath: "/performance",
    robots: "noindex,nofollow"
  }]
]);

export async function readPerformanceMeasurementApi(url, {
  method = "GET",
  environment = "unknown",
  save = false
} = {}) {
  if (url.pathname === "/api/performance-measurements/run") {
    if (method !== "POST" && method !== "GET") {
      return { error: "method_not_allowed" };
    }
    const run = await runPerformanceMeasurements({ environment, save });
    return {
      latest: run,
      runs: [],
      live: true,
      saved: Boolean(run.id),
      schemaReady: true
    };
  }

  return readPerformanceMeasurementStatus({
    limit: Number(url.searchParams.get("limit") || 10)
  });
}
