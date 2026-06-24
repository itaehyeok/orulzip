async function loadDataHealthDashboard() {
  if (!els.dataHealthView) return;
  renderDataHealthLoading();
  try {
    const status = await api("/api/data-health?limit=12");
    renderDataHealthDashboard(status);
  } catch (error) {
    renderDataHealthError(error);
  }
}

function renderDataHealthLoading() {
  if (els.dataHealthSummary) {
    els.dataHealthSummary.innerHTML = `<div class="data-health-empty">데이터 상태를 불러오는 중입니다.</div>`;
  }
  if (els.dataHealthCheckRows) {
    els.dataHealthCheckRows.innerHTML = `<div class="data-health-empty">검증 항목을 불러오는 중입니다.</div>`;
  }
  if (els.dataHealthRunRows) {
    els.dataHealthRunRows.innerHTML = `<tr><td colspan="5" class="empty">최근 실행 이력을 불러오는 중입니다.</td></tr>`;
  }
}

function renderDataHealthError(error) {
  const message = error?.message || "데이터 상태를 불러오지 못했습니다.";
  if (els.dataHealthSummary) {
    els.dataHealthSummary.innerHTML = `<div class="data-health-empty error">${escapeHtml(message)}</div>`;
  }
  if (els.dataHealthCheckRows) els.dataHealthCheckRows.innerHTML = "";
  if (els.dataHealthRunRows) {
    els.dataHealthRunRows.innerHTML = `<tr><td colspan="5" class="empty">${escapeHtml(message)}</td></tr>`;
  }
}

function renderDataHealthDashboard(status) {
  const latest = status?.latest || null;
  renderDataHealthSummary(latest, status);
  renderDataHealthChecks(latest?.checks || []);
  renderDataHealthRuns(status?.runs || []);
}

function renderDataHealthSummary(run, status = {}) {
  if (!els.dataHealthSummary) return;
  if (!run) {
    const message = status?.schemaReady === false
      ? (status.message || "데이터 상태 테이블이 아직 준비되지 않았습니다.")
      : "아직 저장된 데이터 상태 검증 결과가 없습니다.";
    els.dataHealthSummary.innerHTML = `<div class="data-health-empty">${escapeHtml(message)}</div>`;
    return;
  }
  const summary = run.summary || {};
  els.dataHealthSummary.innerHTML = `
    ${dataHealthSummaryCard("상태", dataHealthStatusText(run.status), dataHealthStatusMeta(run), `status-${run.status}`)}
    ${dataHealthSummaryCard("기준월", formatDataHealthMonth(summary.endMonth), `최근수집 ${formatRecentMonths(summary.recentMonths)}`)}
    ${dataHealthSummaryCard("실패", formatInt(run.issueCount), "즉시 확인 필요")}
    ${dataHealthSummaryCard("주의", formatInt(run.warningCount), "데이터는 보이나 점검 필요")}
    ${dataHealthSummaryCard("검증항목", formatInt(summary.checkCount || (run.checks || []).length), formatDateTime(run.finishedAt))}
  `;
}

function dataHealthSummaryCard(label, value, meta, extraClass = "") {
  return `
    <article class="data-health-summary-card ${escapeHtml(extraClass)}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <em>${escapeHtml(meta || "-")}</em>
    </article>
  `;
}

function renderDataHealthChecks(checks) {
  if (!els.dataHealthCheckRows) return;
  if (!checks.length) {
    els.dataHealthCheckRows.innerHTML = `<div class="data-health-empty">표시할 검증 항목이 없습니다.</div>`;
    return;
  }
  els.dataHealthCheckRows.innerHTML = checks.map((check) => {
    const issueDetails = dataHealthIssueDetails(check.details || []);
    return `
      <article class="data-health-check-card status-${escapeHtml(check.status || "unknown")}">
        <div class="data-health-check-head">
          <div>
            <strong>${escapeHtml(check.title || check.key || "검증 항목")}</strong>
            <span>${escapeHtml(check.message || "-")}</span>
          </div>
          <span class="status-pill ${escapeHtml(dataHealthStatusClass(check.status))}">${escapeHtml(dataHealthStatusText(check.status))}</span>
        </div>
        ${renderDataHealthMetricList(check.metrics || {})}
        ${issueDetails.length ? `
          <details class="data-health-detail-list">
            <summary>점검 상세 ${formatInt(issueDetails.length)}개</summary>
            <div>
              ${issueDetails.slice(0, 40).map(renderDataHealthDetail).join("")}
            </div>
          </details>
        ` : ""}
      </article>
    `;
  }).join("");
}

function renderDataHealthMetricList(metrics) {
  const entries = Object.entries(metrics)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 8);
  if (!entries.length) return "";
  return `
    <div class="data-health-metrics">
      ${entries.map(([key, value]) => `
        <span><b>${escapeHtml(dataHealthMetricLabel(key))}</b>${escapeHtml(dataHealthMetricValue(value, key))}</span>
      `).join("")}
    </div>
  `;
}

function renderDataHealthDetail(detail) {
  return `
    <div class="data-health-detail status-${escapeHtml(detail.status || "unknown")}">
      <span class="status-pill ${escapeHtml(dataHealthStatusClass(detail.status))}">${escapeHtml(dataHealthStatusText(detail.status))}</span>
      <strong>${escapeHtml(detail.label || detail.month || detail.startMonth || "-")}</strong>
      <em>${escapeHtml(dataHealthDetailReason(detail))}</em>
    </div>
  `;
}

function renderDataHealthRuns(runs) {
  if (!els.dataHealthRunRows) return;
  els.dataHealthRunRows.innerHTML = runs.length
    ? runs.map((run) => `
      <tr>
        <td><span class="status-pill ${escapeHtml(dataHealthStatusClass(run.status))}">${escapeHtml(dataHealthStatusText(run.status))}</span></td>
        <td>${escapeHtml(run.environment || "-")}</td>
        <td>${escapeHtml(formatDateTime(run.finishedAt || run.createdAt))}</td>
        <td>${formatInt(run.issueCount)} / ${formatInt(run.warningCount)}</td>
        <td>${escapeHtml(formatDataHealthMonth(run.summary?.endMonth || ""))}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="5" class="empty">최근 실행 이력이 없습니다.</td></tr>`;
}

function dataHealthIssueDetails(details) {
  const issues = details.filter((item) => item.status === "fail" || item.status === "warn");
  return issues.length ? issues : details.slice(0, 12);
}

function dataHealthStatusText(status) {
  return {
    pass: "정상",
    warn: "주의",
    fail: "실패"
  }[status] || "미확인";
}

function dataHealthStatusClass(status) {
  return {
    pass: "completed",
    warn: "pending",
    fail: "failed"
  }[status] || "pending";
}

function dataHealthStatusMeta(run) {
  if (run.status === "pass") return "운영 데이터 정상";
  if (run.status === "warn") return "일부 항목 점검 필요";
  if (run.status === "fail") return "누락 데이터 확인 필요";
  return "-";
}

function dataHealthMetricLabel(key) {
  return {
    expectedLawdCount: "대상 시군구",
    checkedMonths: "검사월",
    failedMonths: "실패월",
    completedLawdCount: "완료 시군구",
    missingLawdCount: "미완료 시군구",
    completedFetches: "완료 fetch",
    runningFetches: "진행중 fetch",
    failedFetches: "실패 fetch",
    savedCount: "저장",
    totalDeals: "거래",
    dealCount: "거래",
    lawdCount: "시군구",
    totalCount: "단지",
    coordinateCount: "좌표",
    coordinateRate: "좌표 커버리지",
    householdCount: "세대수",
    householdRate: "세대수 커버리지",
    household100Count: "100세대+",
    reviewCount: "검토 필요",
    expectedSnapshots: "필수 조합",
    foundSnapshots: "준비 조합",
    failedSnapshots: "실패",
    warningSnapshots: "주의",
    apartmentCount: "단지",
    areaCount: "면적",
    apartmentDataCount: "데이터 단지",
    bandCount: "가격대",
    itemCount: "단지",
    updatedAt: "갱신시각"
  }[key] || key;
}

function dataHealthMetricValue(value, key = "") {
  if (typeof value === "number") {
    if (/Rate$/.test(key) || (Math.abs(value) > 0 && Math.abs(value) < 1)) return `${(value * 100).toFixed(1)}%`;
    return formatInt(value);
  }
  if (typeof value === "string" && /^\d{6}$/.test(value)) return formatDataHealthMonth(value);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateTime(value);
  return String(value);
}

function dataHealthDetailReason(detail) {
  const reason = {
    snapshot_missing: "캐시 없음",
    empty_level: `비어 있음${detail.missingLevels?.length ? ` · ${detail.missingLevels.join(", ")}` : ""}`,
    stale_cache: "갱신 지연",
    core_empty: "핵심 데이터 없음",
    area_empty: "해당 평형 데이터 없음"
  }[detail.reason] || "";
  if (reason) return reason;
  if (detail.missingLawdCount) return `미완료 ${formatInt(detail.missingLawdCount)}개`;
  if (detail.dealCount === 0) return "거래 저장 0건";
  return detail.updatedAt ? formatDateTime(detail.updatedAt) : "-";
}

function formatDataHealthMonth(value) {
  const text = String(value || "");
  if (!/^\d{6}$/.test(text)) return text || "-";
  return `${text.slice(2, 4)}.${text.slice(4, 6)}`;
}

function formatRecentMonths(months) {
  return Array.isArray(months) && months.length
    ? months.map(formatDataHealthMonth).join(", ")
    : "-";
}
