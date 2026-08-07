const telegramApiBaseUrl = "https://api.telegram.org";
const telegramTimeoutMs = 3500;
const cacheFallbackAlertState = new Map();
const mapLoadFailureAlertState = new Map();

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

export async function notifyTelegramCacheFallback(event = {}) {
  const config = telegramConfig();
  if (!config.botToken || !config.chatId) return { sent: false, reason: "not_configured" };
  if (!isTelegramCacheAlertEnvironment(event.environment)) return { sent: false, reason: "environment_filtered" };

  const key = cacheFallbackAlertKey(event);
  const throttleMs = positiveNumber(process.env.ORULZIP_TELEGRAM_CACHE_ALERT_THROTTLE_MS, 6 * 60 * 60 * 1000);
  const now = Date.now();
  const lastSentAt = cacheFallbackAlertState.get(key) || 0;
  if (lastSentAt && now - lastSentAt < throttleMs) {
    return { sent: false, reason: "throttled" };
  }
  cacheFallbackAlertState.set(key, now);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), telegramTimeoutMs);
  try {
    const response = await fetch(`${telegramApiBaseUrl}/bot${config.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: telegramCacheFallbackMessage(event),
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

export async function notifyTelegramDataHealth(event = {}) {
  const config = telegramConfig();
  if (!config.botToken || !config.chatId) return { sent: false, reason: "not_configured" };
  if (!isTelegramDataHealthEnvironment(event.environment)) return { sent: false, reason: "environment_filtered" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), telegramTimeoutMs);
  try {
    const response = await fetch(`${telegramApiBaseUrl}/bot${config.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: telegramDataHealthMessage(event),
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

export async function notifyTelegramKbCrawl(event = {}) {
  const config = telegramConfig();
  if (!config.botToken || !config.chatId) return { sent: false, reason: "not_configured" };
  if (!isTelegramKbCrawlEnvironment(event.environment)) return { sent: false, reason: "environment_filtered" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), telegramTimeoutMs);
  try {
    const response = await fetch(`${telegramApiBaseUrl}/bot${config.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: telegramKbCrawlMessage(event),
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

export async function notifyTelegramMapLoadFailure(event = {}) {
  const config = telegramConfig();
  if (!config.botToken || !config.chatId) return { sent: false, reason: "not_configured" };
  if (!isTelegramMapAlertEnvironment(event.environment)) return { sent: false, reason: "environment_filtered" };

  const key = mapLoadFailureAlertKey(event);
  const throttleMs = positiveNumber(process.env.ORULZIP_TELEGRAM_MAP_ALERT_THROTTLE_MS, 30 * 60 * 1000);
  const now = Date.now();
  const lastSentAt = mapLoadFailureAlertState.get(key) || 0;
  if (lastSentAt && now - lastSentAt < throttleMs) {
    return { sent: false, reason: "throttled" };
  }
  mapLoadFailureAlertState.set(key, now);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), telegramTimeoutMs);
  try {
    const response = await fetch(`${telegramApiBaseUrl}/bot${config.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: telegramMapLoadFailureMessage(event),
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

function isTelegramCacheAlertEnvironment(environment) {
  const allowed = String(process.env.ORULZIP_TELEGRAM_CACHE_ALERT_ENVIRONMENTS || "production,development")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.length || allowed.includes("all")) return true;
  return allowed.includes(String(environment || "unknown").toLowerCase());
}

function isTelegramDataHealthEnvironment(environment) {
  const allowed = String(process.env.ORULZIP_TELEGRAM_DATA_HEALTH_ENVIRONMENTS || "production")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.length || allowed.includes("all")) return true;
  return allowed.includes(String(environment || "unknown").toLowerCase());
}

function isTelegramMapAlertEnvironment(environment) {
  const allowed = String(process.env.ORULZIP_TELEGRAM_MAP_ALERT_ENVIRONMENTS || "production,development")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.length || allowed.includes("all")) return true;
  return allowed.includes(String(environment || "unknown").toLowerCase());
}

function isTelegramKbCrawlEnvironment(environment) {
  const allowed = String(process.env.ORULZIP_TELEGRAM_KB_CRAWL_ENVIRONMENTS || "production")
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

function telegramCacheFallbackMessage(event) {
  const lines = [
    "오를집 캐시 fallback 발생",
    `환경: ${event.environment || "unknown"}`,
    `종류: ${event.kind || "미확인"}`,
    `기간: ${event.period || "-"}`,
    `조건: ${event.conditions || "-"}`,
    `사유: ${event.reason || "캐시 미스"}`,
    `처리: ${event.action || "실시간 계산으로 응답"}`
  ];
  if (event.source) lines.push(`소스: ${event.source}`);
  if (event.request) lines.push(`요청: ${event.request}`);
  return lines.join("\n");
}

function telegramMapLoadFailureMessage(event) {
  const lines = [
    "오를집 네이버 지도 로딩 실패",
    `환경: ${event.environment || "unknown"}`,
    `원인: ${event.reason || event.message || "미확인"}`,
    `상세: ${event.failureDetail || mapLoadFailureDetailFallback(event)}`,
    `코드: ${event.code || "unknown"}`,
    `단계: ${event.stage || "-"}`,
    `경과시간: ${mapLoadDurationLine(event)}`,
    `페이지: ${event.url || event.path || "-"}`,
    `배포: ${event.deployCommitSha || "-"} / ${event.deployedAtKst || "-"}`,
    `기간: ${event.period || "-"}`,
    `화면: ${[event.viewport, event.screen ? `screen ${event.screen}` : ""].filter(Boolean).join(" / ") || "-"}`,
    `타일: ${mapLoadTileLine(event.tileStats)}`,
    `브라우저상태: ${mapLoadBrowserInfoLine(event.browserInfo)}`,
    `접속 분류: ${event.visitorTypeLabel || event.visitorType || "판단 불가"}`,
    `판단 신뢰도: ${event.visitorConfidenceLabel || event.visitorConfidence || "미확인"} · ${event.visitorCertainty || "불확실"}`,
    `판단 근거: ${event.visitorReason || "근거 없음"}`
  ];
  if (event.userAgent) lines.push(`UA: ${truncateText(event.userAgent, 160)}`);
  if (event.stack) lines.push("", truncateText(event.stack, 700));
  return lines.join("\n");
}

function mapLoadFailureDetailFallback(event = {}) {
  return {
    "auth-failure": "네이버 지도 SDK 인증 실패입니다. NCP Maps 키의 Web 서비스 URL 허용 도메인을 확인해야 합니다.",
    "sdk-load-failed": "네이버 지도 SDK 스크립트 요청이 실패했습니다.",
    "sdk-timeout": "네이버 지도 SDK callback이 제한 시간 안에 호출되지 않았습니다.",
    "sdk-unavailable": "SDK 로드 후 window.naver.maps 객체를 사용할 수 없습니다.",
    "map-create-failed": "네이버 지도 객체 생성 중 예외가 발생했습니다.",
    "tile-timeout": "네이버 지도 객체는 생성됐지만 첫 지도 타일 이미지가 제한 시간 안에 로드되지 않았습니다.",
    "missing-key": "서버가 네이버 지도 키를 내려주지 않았습니다.",
    disabled: "서버 설정에서 네이버 지도가 비활성화되어 있습니다.",
    "provider-unavailable": "클라이언트 지도 provider 설정을 찾지 못했습니다."
  }[event.code] || "네이버 지도 로딩 실패 원인이 분류되지 않았습니다.";
}

function mapLoadDurationLine(event = {}) {
  const elapsed = formatDurationMs(event.elapsedMs);
  const timeout = formatDurationMs(event.timeoutMs);
  const over = formatDurationMs(event.overMs);
  if (!elapsed && !timeout) return "미측정";
  return [
    elapsed ? `${elapsed} 경과` : "",
    timeout ? `${timeout} 제한` : "",
    over ? `${over} 초과` : ""
  ].filter(Boolean).join(" / ");
}

function formatDurationMs(value) {
  if (value === null || value === undefined || value === "") return "";
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return `${(Math.max(0, number) / 1000).toFixed(2)}초`;
}

function mapLoadTileLine(tileStats = {}) {
  if (!tileStats || typeof tileStats !== "object") return "미확인";
  const images = formatNullableCount(tileStats.images);
  const visible = formatNullableCount(tileStats.visibleImages);
  const loaded = formatNullableCount(tileStats.loadedVisibleImages);
  return `전체 ${images}개 / 표시 ${visible}개 / 로드 ${loaded}개`;
}

function mapLoadBrowserInfoLine(browserInfo = {}) {
  if (!browserInfo || typeof browserInfo !== "object") return "미확인";
  const online = typeof browserInfo.online === "boolean" ? (browserInfo.online ? "online" : "offline") : "";
  const touch = browserInfo.touchPoints !== null && browserInfo.touchPoints !== undefined && Number.isFinite(Number(browserInfo.touchPoints))
    ? `touch ${browserInfo.touchPoints}`
    : "";
  return [
    browserInfo.visibilityState,
    online,
    browserInfo.connectionType,
    browserInfo.saveData ? "saveData" : "",
    browserInfo.platform,
    browserInfo.language,
    touch
  ].filter(Boolean).join(" / ") || "미확인";
}

function telegramDataHealthMessage(event) {
  const summary = event.summary || {};
  const checks = Array.isArray(event.checks) ? event.checks : [];
  const issueChecks = checks.filter((check) => check.status === "fail");
  const warningChecks = checks.filter((check) => check.status === "warn");
  const lines = [
    `오를집 데이터 상태 ${dataHealthStatusLabel(event.status)}`,
    `환경: ${event.environment || "unknown"}`,
    `기준월: ${summary.endMonth || "-"}`,
    `최근수집: ${Array.isArray(summary.recentMonths) ? summary.recentMonths.join(", ") : "-"}`,
    `결과: 실패 ${formatCount(summary.issueCount)} · 주의 ${formatCount(summary.warningCount)}`
  ];
  const topChecks = [...issueChecks, ...warningChecks].slice(0, 8);
  if (topChecks.length) {
    lines.push("", "점검 항목");
    for (const check of topChecks) {
      lines.push(`- ${dataHealthStatusLabel(check.status)} ${check.title || check.key}: ${check.message || "-"}`);
    }
  }
  return lines.join("\n");
}

export function telegramKbCrawlMessage(event = {}) {
  const title = {
    monitoring_started: "오를집 KB 수집 알림 시작",
    discovery_completed: "오를집 KB 단지 탐색 완료",
    progress: `오를집 KB ${event.stage || "수집"} ${formatCount(event.threshold)}%`,
    stage_completed: `오를집 KB ${event.stage || "수집"} 완료`,
    item_failure: "오를집 KB 수집 오류 발생",
    job_failed: "오를집 KB 수집 작업 실패",
    cache_failed: "오를집 KB 지도 캐시 갱신 실패",
    all_completed: "오를집 KB 전체 수집 완료"
  }[event.kind] || "오를집 KB 수집 알림";
  const lines = [
    title,
    `환경: ${event.environment || "unknown"}`,
    `지역: ${event.regionName || event.regionId || "미확인"}`
  ];

  if (event.kind === "monitoring_started") {
    lines.push(
      `작업: ${Array.isArray(event.jobIds) ? event.jobIds.map((id) => `#${id}`).join(" -> ") : "-"}`,
      `현재 단계: ${event.stage || "대기"}`
    );
    if (Number(event.total) > 0) lines.push(kbCrawlProgressLine(event));
  } else if (event.kind === "discovery_completed") {
    lines.push(
      `발견 단지: ${formatCount(event.total)}개`,
      `작업: #${event.jobId || "-"}`
    );
  } else if (["progress", "stage_completed", "item_failure", "job_failed", "cache_failed"].includes(event.kind)) {
    lines.push(
      `단계: ${event.stage || "-"}`,
      kbCrawlProgressLine(event),
      `작업: #${event.jobId || "-"}`
    );
    if (event.currentComplexName) lines.push(`현재 단지: ${event.currentComplexName}`);
    if (event.errorMessage) lines.push(`오류: ${truncateText(event.errorMessage, 500)}`);
  } else if (event.kind === "all_completed") {
    const coverage = event.coverage || {};
    lines.push(
      `기본정보: ${kbCrawlStageSummary(event.sourceJob)}`,
      `10년 시세: ${kbCrawlStageSummary(event.finalJob)}`,
      `아파트: ${formatCount(coverage.apartments)}개`,
      `면적형: ${formatCount(coverage.areaTypes)}개`,
      `월별 시세: ${formatCount(coverage.monthlyPrices)}건`,
      `시세 기간: ${coverage.minMonth || "-"} ~ ${coverage.maxMonth || "-"}`,
      `KB 지도 캐시: 갱신 완료`,
      `총 소요시간: ${formatLongDurationMs(event.elapsedMs) || "미측정"}`
    );
  }

  return lines.join("\n");
}

function kbCrawlProgressLine(event = {}) {
  const completed = Number(event.completed || 0);
  const failed = Number(event.failed || 0);
  const total = Number(event.total || 0);
  const processed = Math.min(total || completed + failed, completed + failed);
  const percent = total > 0 ? ((processed / total) * 100).toFixed(1) : "0.0";
  return `진행: ${formatCount(processed)}/${formatCount(total)} (${percent}%) · 성공 ${formatCount(completed)} · 실패 ${formatCount(failed)}`;
}

function kbCrawlStageSummary(job = {}) {
  const completed = Number(job.completed || 0);
  const failed = Number(job.failed || 0);
  const total = Number(job.total || 0);
  return `${formatCount(completed)}/${formatCount(total)} · 실패 ${formatCount(failed)}`;
}

function formatLongDurationMs(value) {
  const milliseconds = Number(value);
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return "";
  const totalMinutes = Math.max(1, Math.round(milliseconds / 60_000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  return [
    days ? `${days}일` : "",
    hours ? `${hours}시간` : "",
    minutes || (!days && !hours) ? `${minutes}분` : ""
  ].filter(Boolean).join(" ");
}

function dataHealthStatusLabel(status) {
  return {
    pass: "정상",
    warn: "주의",
    fail: "실패"
  }[status] || "미확인";
}

function cacheFallbackAlertKey(event) {
  if (event.dedupeKey) {
    return [event.environment || "unknown", event.dedupeKey].join("|");
  }
  return [
    event.environment || "unknown",
    event.kind || "unknown",
    event.source || "",
    event.period || "",
    event.conditions || "",
    event.reason || ""
  ].join("|");
}

function mapLoadFailureAlertKey(event) {
  if (event.dedupeKey) {
    return [event.environment || "unknown", event.dedupeKey].join("|");
  }
  return [
    event.environment || "unknown",
    event.code || "unknown",
    event.stage || "",
    event.deployCommitSha || "",
    event.path || ""
  ].join("|");
}

function truncateText(value, maxLength) {
  const text = String(value || "");
  const limit = Math.max(0, Number(maxLength) || 0);
  if (!limit || text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 1))}…`;
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

function formatNullableCount(value) {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number).toLocaleString("ko-KR") : "-";
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
