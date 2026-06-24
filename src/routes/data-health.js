import { readDataHealthStatus } from "../services/data-health.js";

export const DATA_HEALTH_APP_ROUTES = new Set(["/data-health"]);
export const DATA_HEALTH_PROTECTED_API_ROUTES = new Set(["/api/data-health"]);
export const DATA_HEALTH_ROUTE_SEO = new Map([
  ["/data-health", {
    title: "데이터 상태 - 오를집",
    description: "오를집 운영 데이터 수집과 캐시 검증 상태 화면입니다.",
    canonicalPath: "/data-health",
    robots: "noindex,nofollow"
  }]
]);

export async function readDataHealthApi(url) {
  return readDataHealthStatus({
    limit: Number(url.searchParams.get("limit") || 10)
  });
}
