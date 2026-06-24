async function loadPerformanceDashboard() {
  if (!els.performanceView) return;
  renderPerformanceLoading();
  try {
    const status = await api("/api/performance-measurements?limit=10");
    renderPerformanceDashboard(status);
  } catch (error) {
    renderPerformanceError(error);
  }
}

async function runPerformanceMeasurementNow() {
  if (!els.performanceView) return;
  const button = els.performanceRunBtn;
  if (button) {
    button.disabled = true;
    button.textContent = "측정 중";
  }
  renderPerformanceManualRunning();
  try {
    const response = await fetch("/api/performance-measurements/run", { method: "POST" });
    const status = await response.json();
    if (!response.ok) throw new Error(status.error || "성능 측정에 실패했습니다.");
    renderPerformanceDashboard(status);
  } catch (error) {
    renderPerformanceError(error);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "지금 다시 측정";
    }
  }
}

function renderPerformanceLoading() {
  if (els.performanceSummary) {
    els.performanceSummary.innerHTML = `<div class="data-health-empty">성능 측정 결과를 불러오는 중입니다.</div>`;
  }
  if (els.performanceMatrix) {
    els.performanceMatrix.innerHTML = `<div class="data-health-empty">측정 항목을 불러오는 중입니다.</div>`;
  }
  if (els.performanceRunRows) {
    els.performanceRunRows.innerHTML = `<tr><td colspan="5" class="empty">최근 실행 이력을 불러오는 중입니다.</td></tr>`;
  }
}

function renderPerformanceManualRunning() {
  if (els.performanceSummary) {
    els.performanceSummary.innerHTML = `<div class="data-health-empty">현재 캐시 응답 속도를 측정하는 중입니다.</div>`;
  }
  if (els.performanceMatrix) {
    els.performanceMatrix.innerHTML = `<div class="data-health-empty">지도 마커와 랭킹 캐시를 기간별로 확인하고 있습니다.</div>`;
  }
}

function renderPerformanceError(error) {
  const message = error?.message || "성능 측정 결과를 불러오지 못했습니다.";
  if (els.performanceSummary) {
    els.performanceSummary.innerHTML = `<div class="data-health-empty error">${escapeHtml(message)}</div>`;
  }
  if (els.performanceMatrix) els.performanceMatrix.innerHTML = "";
  if (els.performanceRunRows) {
    els.performanceRunRows.innerHTML = `<tr><td colspan="5" class="empty">${escapeHtml(message)}</td></tr>`;
  }
}

function renderPerformanceDashboard(status = {}) {
  const latest = status.latest || null;
  renderPerformanceSummary(latest, status);
  renderPerformanceMatrix(latest, status);
  renderPerformanceRuns(status.runs || []);
}

function renderPerformanceSummary(run, status = {}) {
  if (!els.performanceSummary) return;
  if (!run) {
    const message = status.message || "아직 저장된 성능 측정 이력이 없습니다. 오른쪽 상단의 지금 다시 측정을 눌러 확인할 수 있습니다.";
    els.performanceSummary.innerHTML = `<div class="data-health-empty">${escapeHtml(message)}</div>`;
    return;
  }
  const summary = run.summary || {};
  const statusClass = performanceSummaryStatusClass(run.status);
  els.performanceSummary.innerHTML = `
    ${performanceSummaryCard("상태", performanceStatusText(run.status), performanceStatusMeta(run), `status-${statusClass}`)}
    ${performanceSummaryCard("최대 지연", formatPerformanceSeconds(summary.maxDurationMs), performanceSlowestMeta(summary.slowest))}
    ${performanceSummaryCard("평균", formatPerformanceSeconds(summary.averageDurationMs), `${formatInt(summary.measurementCount || 0)}개 항목`)}
    ${performanceSummaryCard("실패 / 주의", `${formatInt(run.issueCount)} / ${formatInt(run.warningCount)}`, performanceThresholdMeta(summary.thresholds || status.thresholds))}
    ${performanceSummaryCard("완료 시각", formatDateTime(run.finishedAt), run.live ? "수동 측정 결과" : "저장된 최근 측정")}
  `;
}

function performanceSummaryCard(label, value, meta, extraClass = "") {
  return `
    <div class="data-health-summary-card ${escapeHtml(extraClass)}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "-")}</strong>
      <em>${escapeHtml(meta || "")}</em>
    </div>
  `;
}

function renderPerformanceMatrix(run, status = {}) {
  if (!els.performanceMatrix) return;
  if (!run) {
    els.performanceMatrix.innerHTML = `<div class="data-health-empty">표시할 측정 결과가 없습니다.</div>`;
    return;
  }
  const periods = status.periods || performancePeriodsFromRun(run);
  const units = status.units || performanceUnitsFromRun(run);
  const byKey = new Map((run.measurements || []).map((item) => [`${item.unitKey}:${item.periodKey}`, item]));
  els.performanceMatrix.innerHTML = `
    <div class="performance-table-wrap">
      <table class="performance-table">
        <thead>
          <tr>
            <th>단위</th>
            ${periods.map((period) => `<th>${escapeHtml(period.label)}</th>`).join("")}
            <th>마지막 측정</th>
          </tr>
        </thead>
        <tbody>
          ${units.map((unit) => renderPerformanceMatrixRow(unit, periods, byKey, run)).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderPerformanceMatrixRow(unit, periods, byKey, run) {
  const cells = periods.map((period) => {
    const measurement = byKey.get(`${unit.key}:${period.key}`);
    return renderPerformanceMatrixCell(measurement);
  }).join("");
  return `
    <tr>
      <th>
        <strong>${escapeHtml(unit.label || unit.key)}</strong>
        <span>${escapeHtml(unit.group || "")}</span>
      </th>
      ${cells}
      <td class="performance-measured-at">${escapeHtml(formatDateTime(run.finishedAt))}</td>
    </tr>
  `;
}

function renderPerformanceMatrixCell(measurement) {
  if (!measurement) {
    return `<td class="performance-cell status-pending"><strong>-</strong><span>미측정</span></td>`;
  }
  const statusClass = performanceStatusClass(measurement.status);
  const cacheMonth = measurement.snapshot
    ? `${formatPerformanceMonth(measurement.snapshot.startMonth)}-${formatPerformanceMonth(measurement.snapshot.endMonth)}`
    : "-";
  const title = [
    measurement.message || "",
    measurement.cacheUpdatedAt ? `캐시 갱신 ${formatDateTime(measurement.cacheUpdatedAt)}` : "",
    measurement.cacheSource ? `소스 ${measurement.cacheSource}` : ""
  ].filter(Boolean).join(" / ");
  return `
    <td class="performance-cell status-${escapeHtml(statusClass)}" title="${escapeHtml(title)}">
      <strong>${escapeHtml(formatPerformanceSeconds(measurement.durationMs))}</strong>
      <span>${escapeHtml(performanceStatusText(measurement.status))} · ${escapeHtml(formatInt(measurement.dataCount))}개</span>
      <em>${escapeHtml(cacheMonth)}</em>
    </td>
  `;
}

function renderPerformanceRuns(runs) {
  if (!els.performanceRunRows) return;
  els.performanceRunRows.innerHTML = runs.length
    ? runs.map((run) => `
      <tr>
        <td><span class="status-pill ${escapeHtml(performanceStatusClass(run.status))}">${escapeHtml(performanceStatusText(run.status))}</span></td>
        <td>${escapeHtml(run.environment || "-")}</td>
        <td>${escapeHtml(formatDateTime(run.finishedAt))}</td>
        <td>${formatInt(run.issueCount)} / ${formatInt(run.warningCount)}</td>
        <td>${escapeHtml(formatPerformanceSeconds(run.summary?.maxDurationMs))}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="5" class="empty">저장된 실행 이력이 없습니다.</td></tr>`;
}

function performancePeriodsFromRun(run) {
  const map = new Map();
  (run.measurements || []).forEach((item) => {
    map.set(item.periodKey, { key: item.periodKey, label: item.periodLabel });
  });
  return [...map.values()];
}

function performanceUnitsFromRun(run) {
  const map = new Map();
  (run.measurements || []).forEach((item) => {
    map.set(item.unitKey, {
      key: item.unitKey,
      label: item.unitLabel,
      group: item.unitGroup
    });
  });
  return [...map.values()];
}

function performanceStatusText(status) {
  if (status === "pass") return "정상";
  if (status === "warn") return "주의";
  if (status === "fail") return "실패";
  return "대기";
}

function performanceStatusClass(status) {
  if (status === "pass") return "completed";
  if (status === "warn") return "running";
  if (status === "fail") return "failed";
  return "pending";
}

function performanceSummaryStatusClass(status) {
  if (status === "pass") return "pass";
  if (status === "warn") return "warn";
  if (status === "fail") return "fail";
  return "";
}

function performanceStatusMeta(run) {
  if (!run) return "";
  return `${formatInt(run.summary?.passCount || 0)}개 정상 · ${formatInt(run.durationMs || 0)}ms`;
}

function performanceSlowestMeta(slowest) {
  if (!slowest) return "";
  return `${slowest.unitLabel || "-"} · ${slowest.periodLabel || "-"}`;
}

function performanceThresholdMeta(thresholds = {}) {
  const warnMs = Number(thresholds.warnMs || 0);
  const failMs = Number(thresholds.failMs || 0);
  return `주의 ${formatPerformanceSeconds(warnMs)} · 실패 ${formatPerformanceSeconds(failMs)}`;
}

function formatPerformanceSeconds(ms) {
  const number = Number(ms);
  if (!Number.isFinite(number) || number <= 0) return "0.00초";
  return `${(number / 1000).toFixed(2)}초`;
}

function formatPerformanceMonth(value) {
  const text = String(value || "");
  if (!/^\d{6}$/.test(text)) return "-";
  return `${text.slice(2, 4)}.${text.slice(4, 6)}`;
}
