function trackAnalyticsPageView() {
  const pageKey = `${window.location.pathname}|${state.activeTab}`;
  const now = Date.now();
  if (state.analyticsLastPageKey === pageKey && now - state.analyticsLastPageTrackedAt < 1200) return;
  state.analyticsLastPageKey = pageKey;
  state.analyticsLastPageTrackedAt = now;
  trackAnalyticsEvent("page_view", {
    activeTab: state.activeTab,
    mapSource: isMapTab() ? currentMapSource() : "",
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight
  });
}

function trackAnalyticsEvent(eventName, metadata = {}) {
  const payload = {
    eventName,
    path: window.location.pathname,
    title: document.title,
    referrer: document.referrer || "",
    metadata: {
      ...metadata,
      activeTab: state.activeTab
    }
  };
  const body = JSON.stringify(payload);
  fetch("/api/analytics/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    keepalive: true,
    body
  }).catch(() => {});
}

async function loadAnalyticsDashboard() {
  if (!els.analyticsView) return;
  const requestId = ++state.analyticsRequestId;
  const days = Number(els.analyticsDaysSelect?.value || state.analyticsDays || 7);
  const includeAdmin = Boolean(els.analyticsIncludeAdminToggle?.checked);
  state.analyticsDays = days;
  state.analyticsIncludeAdmin = includeAdmin;
  renderAnalyticsLoading();

  try {
    const params = new URLSearchParams({
      days: String(days),
      includeAdmin: includeAdmin ? "1" : "0"
    });
    const data = await api(`/api/analytics/summary?${params}`);
    if (requestId !== state.analyticsRequestId) return;
    renderAnalyticsDashboard(data);
  } catch (error) {
    if (requestId !== state.analyticsRequestId) return;
    renderAnalyticsError(error);
  }
}

function renderAnalyticsLoading() {
  if (els.analyticsSummary) {
    els.analyticsSummary.innerHTML = `<div class="analytics-empty">방문 분석 데이터를 불러오는 중입니다.</div>`;
  }
  setAnalyticsRows(els.analyticsDailyRows, 5, "불러오는 중입니다.");
  setAnalyticsRows(els.analyticsPageRows, 5, "불러오는 중입니다.");
  setAnalyticsRows(els.analyticsEventRows, 4, "불러오는 중입니다.");
  setAnalyticsRows(els.analyticsVisitorRows, 6, "불러오는 중입니다.");
  setAnalyticsRows(els.analyticsRecentEventRows, 5, "불러오는 중입니다.");
}

function renderAnalyticsError(error) {
  const message = `방문 분석 데이터를 불러오지 못했습니다. ${error?.message || ""}`;
  if (els.analyticsSummary) {
    els.analyticsSummary.innerHTML = `<div class="analytics-empty error">${escapeHtml(message)}</div>`;
  }
  setAnalyticsRows(els.analyticsDailyRows, 5, message);
  setAnalyticsRows(els.analyticsPageRows, 5, message);
  setAnalyticsRows(els.analyticsEventRows, 4, message);
  setAnalyticsRows(els.analyticsVisitorRows, 6, message);
  setAnalyticsRows(els.analyticsRecentEventRows, 5, message);
}

function renderAnalyticsDashboard(data) {
  renderAnalyticsSummary(data.overview || {}, data.filters || {});
  renderAnalyticsDailyRows(data.daily || []);
  renderAnalyticsPageRows(data.pages || []);
  renderAnalyticsEventRows(data.events || []);
  renderAnalyticsVisitorRows(data.recentVisitors || []);
  renderAnalyticsRecentEventRows(data.recentEvents || []);
}

function renderAnalyticsSummary(overview, filters) {
  if (!els.analyticsSummary) return;
  const periodText = `${formatInt(filters.days || state.analyticsDays || 7)}일`;
  const cards = [
    ["방문자", formatInt(overview.visitors || 0), periodText],
    ["세션", formatInt(overview.sessions || 0), "30분 단위"],
    ["페이지뷰", formatInt(overview.pageViews || 0), "화면 진입"],
    ["이벤트", formatInt(overview.events || 0), "클릭 포함"],
    ["방문 페이지", formatInt(overview.pages || 0), "고유 URL"],
    ["방문자당 이벤트", formatDecimal(Number(overview.eventsPerVisitor || 0), 1), "평균"]
  ];
  els.analyticsSummary.innerHTML = cards.map(([label, value, meta]) => `
    <div class="analytics-summary-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <em>${escapeHtml(meta)}</em>
    </div>
  `).join("");
}

function renderAnalyticsDailyRows(rows) {
  if (!els.analyticsDailyRows) return;
  els.analyticsDailyRows.innerHTML = rows.length
    ? rows.map((row) => `
      <tr>
        <td>${escapeHtml(formatAnalyticsDay(row.day))}</td>
        <td>${formatInt(row.visitors)}</td>
        <td>${formatInt(row.sessions)}</td>
        <td>${formatInt(row.pageViews)}</td>
        <td>${formatInt(row.events)}</td>
      </tr>
    `).join("")
    : emptyAnalyticsRow(5, "선택 기간에 일별 데이터가 없습니다.");
}

function renderAnalyticsPageRows(rows) {
  if (!els.analyticsPageRows) return;
  els.analyticsPageRows.innerHTML = rows.length
    ? rows.map((row) => `
      <tr>
        <td><strong class="table-main">${escapeHtml(row.path || "-")}</strong></td>
        <td>${escapeHtml(row.title || "-")}</td>
        <td>${formatInt(row.pageViews)}</td>
        <td>${formatInt(row.visitors)}</td>
        <td>${escapeHtml(formatDateTime(row.lastSeenAt))}</td>
      </tr>
    `).join("")
    : emptyAnalyticsRow(5, "선택 기간에 페이지뷰가 없습니다.");
}

function renderAnalyticsEventRows(rows) {
  if (!els.analyticsEventRows) return;
  els.analyticsEventRows.innerHTML = rows.length
    ? rows.map((row) => `
      <tr>
        <td><strong class="analytics-event-name">${escapeHtml(analyticsEventLabel(row.eventName))}</strong></td>
        <td>${formatInt(row.events)}</td>
        <td>${formatInt(row.visitors)}</td>
        <td>${escapeHtml(formatDateTime(row.lastSeenAt))}</td>
      </tr>
    `).join("")
    : emptyAnalyticsRow(4, "선택 기간에 이벤트가 없습니다.");
}

function renderAnalyticsVisitorRows(rows) {
  if (!els.analyticsVisitorRows) return;
  els.analyticsVisitorRows.innerHTML = rows.length
    ? rows.map((row) => `
      <tr>
        <td>
          <strong class="table-main">${escapeHtml(shortAnalyticsId(row.visitorId))}</strong>
          ${row.lastIpHash ? `<span class="muted-cell">IP ${escapeHtml(shortAnalyticsHash(row.lastIpHash))}</span>` : ""}
          ${row.hasAdminEvents ? `<span class="analytics-admin-badge">관리자 포함</span>` : ""}
        </td>
        <td>${formatInt(row.periodPageViews)}</td>
        <td>${formatInt(row.periodSessions)}</td>
        <td>${formatInt(row.periodEvents)}</td>
        <td>${escapeHtml(row.lastPath || "-")}</td>
        <td>${escapeHtml(formatDateTime(row.lastSeenAt))}</td>
      </tr>
    `).join("")
    : emptyAnalyticsRow(6, "선택 기간에 방문자가 없습니다.");
}

function renderAnalyticsRecentEventRows(rows) {
  if (!els.analyticsRecentEventRows) return;
  els.analyticsRecentEventRows.innerHTML = rows.length
    ? rows.map((row) => `
      <tr>
        <td>${escapeHtml(formatDateTime(row.createdAt))}</td>
        <td><strong class="analytics-event-name">${escapeHtml(analyticsEventLabel(row.eventName))}</strong></td>
        <td>${escapeHtml(row.path || "-")}</td>
        <td>${escapeHtml(shortAnalyticsId(row.visitorId))}</td>
        <td>${escapeHtml(formatAnalyticsMetadata(row.metadata))}</td>
      </tr>
    `).join("")
    : emptyAnalyticsRow(5, "선택 기간에 이벤트 로그가 없습니다.");
}

function setAnalyticsRows(tbody, colspan, message) {
  if (!tbody) return;
  tbody.innerHTML = emptyAnalyticsRow(colspan, message);
}

function emptyAnalyticsRow(colspan, message) {
  return `<tr><td colspan="${colspan}" class="empty">${escapeHtml(message)}</td></tr>`;
}

function analyticsEventLabel(eventName) {
  return {
    page_view: "페이지뷰",
    apartment_detail_opened: "아파트 상세 열기",
    map_dong_ranking_opened: "동 순위 열기",
    map_ranking_mode_changed: "랭킹 탭 전환",
    map_search_selected: "지도 검색 선택"
  }[eventName] || eventName || "-";
}

function formatAnalyticsDay(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value);
  return date.toLocaleDateString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  });
}

function shortAnalyticsId(value) {
  const text = String(value || "");
  if (!text) return "-";
  return `${text.slice(0, 8)}...${text.slice(-4)}`;
}

function shortAnalyticsHash(value) {
  const text = String(value || "");
  return text ? text.slice(0, 10) : "-";
}

function formatAnalyticsMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return "-";
  const preferred = [
    metadata.apartmentName,
    metadata.dongName,
    metadata.rankMode,
    metadata.mapSource,
    metadata.periodLabel
  ].filter(Boolean);
  if (preferred.length) return preferred.join(" · ").slice(0, 120);
  const keys = Object.keys(metadata).filter((key) => metadata[key] !== "");
  if (!keys.length) return "-";
  return keys.slice(0, 3).map((key) => `${key}:${String(metadata[key]).slice(0, 40)}`).join(" · ");
}
