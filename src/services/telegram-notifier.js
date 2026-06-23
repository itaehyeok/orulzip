const telegramApiBaseUrl = "https://api.telegram.org";
const telegramTimeoutMs = 3500;

export function shouldNotifyExternalVisitorVisit(event = {}) {
  if (event.eventName !== "page_view") return false;
  if (!event.isNewVisitor) return false;
  if (event.isAdmin || event.isInternal) return false;
  return isTelegramVisitorAlertEnvironment(event.environment);
}

export async function notifyTelegramExternalVisitor(event = {}) {
  const config = telegramConfig();
  if (!config.botToken || !config.chatId) return { sent: false, reason: "not_configured" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), telegramTimeoutMs);
  try {
    const response = await fetch(`${telegramApiBaseUrl}/bot${config.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: telegramVisitorMessage(event),
        disable_web_page_preview: true
      }),
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`Telegram sendMessage failed with HTTP ${response.status}`);
    }
    return { sent: true };
  } finally {
    clearTimeout(timeout);
  }
}

function telegramConfig() {
  return {
    botToken: String(process.env.ORULZIP_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "").trim(),
    chatId: String(process.env.ORULZIP_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID || "").trim()
  };
}

function isTelegramVisitorAlertEnvironment(environment) {
  const allowed = String(process.env.ORULZIP_TELEGRAM_VISITOR_ALERT_ENVIRONMENTS || "production")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.length || allowed.includes("all")) return true;
  return allowed.includes(String(environment || "unknown").toLowerCase());
}

function telegramVisitorMessage(event) {
  const userInfo = event.userInfo && typeof event.userInfo === "object" ? event.userInfo : {};
  const url = event.url || "";
  const path = event.path || "/";
  const lines = [
    "오를집 새 외부 방문자",
    `환경: ${event.environment || "unknown"}`,
    `페이지: ${event.title || path}`,
    `경로: ${url || path}`,
    `방문자: ${shortVisitorId(event.visitorId)}`,
    `위치: ${visitorLocation(userInfo)}`,
    `기기: ${visitorDevice(userInfo)}`,
    `화면: ${visitorScreen(userInfo)}`,
    `유입: ${event.referrer || "직접/미확인"}`
  ];

  const campaign = visitorCampaign(userInfo);
  if (campaign) lines.push(`캠페인: ${campaign}`);
  const summaryLines = visitorSummaryLines(event.summary);
  if (summaryLines.length) lines.push("", "방문 요약", ...summaryLines);
  return lines.join("\n");
}

function shortVisitorId(visitorId) {
  const value = String(visitorId || "");
  return value ? value.slice(0, 8) : "unknown";
}

function visitorLocation(userInfo) {
  return [userInfo.country, userInfo.region, userInfo.city].filter(Boolean).join(" / ") || "미확인";
}

function visitorDevice(userInfo) {
  const browser = [userInfo.browser, userInfo.browserVersion].filter(Boolean).join(" ");
  const os = [userInfo.os, userInfo.osVersion].filter(Boolean).join(" ");
  return [userInfo.deviceType, os, browser].filter(Boolean).join(" / ") || "미확인";
}

function visitorScreen(userInfo) {
  const viewport = userInfo.viewportWidth && userInfo.viewportHeight
    ? `${userInfo.viewportWidth}x${userInfo.viewportHeight}`
    : "";
  const screen = userInfo.screenWidth && userInfo.screenHeight
    ? `${userInfo.screenWidth}x${userInfo.screenHeight}`
    : "";
  return [viewport, screen].filter(Boolean).join(" / ") || "미확인";
}

function visitorCampaign(userInfo) {
  return [userInfo.utmSource, userInfo.utmMedium, userInfo.utmCampaign].filter(Boolean).join(" / ");
}

function visitorSummaryLines(summary) {
  if (!summary || typeof summary !== "object") return [];
  return [
    `최근 30분: ${formatCount(summary.activeVisitors30m)}명`,
    `오늘: ${formatCount(summary.todayVisitors)}명 / ${formatCount(summary.todayPageViews)}PV`,
    `최근 7일: ${formatCount(summary.weekVisitors)}명 / ${formatCount(summary.weekPageViews)}PV`,
    `전체: ${formatCount(summary.totalVisitors)}명 / ${formatCount(summary.totalPageViews)}PV`
  ];
}

function formatCount(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.round(number).toLocaleString("ko-KR") : "0";
}
