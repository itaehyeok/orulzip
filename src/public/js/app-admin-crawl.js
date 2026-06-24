async function syncCurrentRegion() {
  const regionId = els.regionSelect.value || "bundang";
  els.syncBtn.disabled = true;
  els.syncBtn.textContent = "동기화 중";
  els.statusLine.textContent = "수집 작업을 등록 중입니다. 실제 수집은 별도 worker가 천천히 처리합니다.";

  try {
    await api(`/api/crawl/start?regionId=${encodeURIComponent(regionId)}&maxComplexes=200&yearsBack=10&maxAreaTypesPerComplex=2&maxTiles=80&delayMinMs=15000&delayMaxMs=60000`);
    await refreshStatusOnly();
  } finally {
    els.syncBtn.disabled = false;
    els.syncBtn.textContent = `${selectedRegionName()} 샘플 동기화`;
  }
}

async function refreshStatusOnly() {
  const status = await api("/api/status");
  state.latestStatus = status;
  renderCollectionSummary();
  renderCrawlStatus(status.crawl);
  const months = status.months || [];
  if (months.length) state.months = months;
  els.statusLine.textContent = status.counts.monthlyPrices
    ? `아파트 ${formatInt(status.counts.apartments)}개, 면적 ${formatInt(status.counts.areaTypes)}개, 월별 시세 ${formatInt(status.counts.monthlyPrices)}건. 최근 저장: ${status.meta.syncedAt || "-"}`
    : "아직 저장된 시세 데이터가 없습니다. 수집 작업을 등록하고 worker가 처리할 때까지 기다려주세요.";
  if (state.activeTab === "crawl") {
    await loadCrawlTabData();
  }
}

function renderCollectionSummary() {
  const status = state.latestStatus || {};
  const crawl = status.crawl || {};
  const molit = state.latestMolitStatus;
  const jobs = crawl.jobProgress || [];
  const kbCoverage = crawl.kbCoverage || [];
  const runningJobs = jobs.filter((item) => ["discovering", "running"].includes(item.job?.status)).length;
  const pendingJobs = jobs.filter((item) => item.job?.status === "requested").length;
  const kbFailed = jobs.reduce((sum, item) => sum + Number(item.job?.failedComplexes || 0), 0);
  const kbStoredComplexes = kbCoverage.reduce((sum, item) => sum + Number(item.storedComplexes || 0), 0);
  const molitProgress = molit?.progress || {};
  const mapCache = status.mapCache || {};

  if (els.collectionSummaryKb) {
    els.collectionSummaryKb.textContent = `${formatInt(runningJobs)}개 진행 중`;
    els.collectionSummaryKbMeta.textContent = `${formatInt(pendingJobs)}개 대기 · KB 단지 ${formatInt(kbStoredComplexes)}개 저장`;
  }
  if (els.collectionSummaryMolit) {
    const completion = molitCompletionSummary(molit);
    els.collectionSummaryMolit.textContent = completion.isComplete ? "완료" : completion.title;
    els.collectionSummaryMolitMeta.textContent = completion.title;
  }
  if (els.collectionSummaryFailure) {
    const molitFailed = Number(molitProgress.failed || 0);
    els.collectionSummaryFailure.textContent = `${formatInt(kbFailed + molitFailed)}개`;
    els.collectionSummaryFailureMeta.textContent = `KB 실패 ${formatInt(kbFailed)} · 실거래 API 실패 ${formatInt(molitFailed)}`;
  }
  if (els.collectionSummaryCache) {
    els.collectionSummaryCache.textContent = mapCache.updatedAt ? formatDateTime(mapCache.updatedAt) : "-";
    els.collectionSummaryCacheMeta.textContent = mapCache.snapshots
      ? `${formatInt(mapCache.snapshots)}개 기간 캐시 · ${formatMonthRange(mapCache.startMonth, mapCache.endMonth)}`
      : "지도 캐시 없음";
  }
}

function renderCrawlStatus(crawl) {
  if (!crawl) {
    els.crawlSummary.textContent = "작업 없음";
    els.progressBar.style.width = "0%";
    els.progressText.textContent = "0%";
    els.currentComplex.textContent = "-";
    els.crawlCounts.textContent = "-";
    els.crawlDelay.textContent = "-";
    els.crawlTrackedJobs.innerHTML = "";
    els.crawlLogs.innerHTML = "";
    renderKbCoverage([]);
    return;
  }

  renderKbCoverage(crawl.kbCoverage || []);
  const job = crawl.job;
  if (!job) {
    els.crawlSummary.textContent = "작업 없음";
    els.progressBar.style.width = "0%";
    els.progressText.textContent = "0%";
    els.currentComplex.textContent = "-";
    els.crawlCounts.textContent = "-";
    els.crawlDelay.textContent = "-";
    els.crawlTrackedJobs.innerHTML = renderCrawlJobProgress(crawl.jobProgress || []);
    els.crawlLogs.innerHTML = "";
    return;
  }
  const activeProgress = crawlJobProgress({ job, queueCounts: crawl.queueCounts || {}, progress: crawl.progress || 0 });
  els.crawlSummary.textContent = `${crawlJobLabel(job)} / ${statusLabel(job.status)}`;
  els.progressBar.style.width = `${activeProgress.percent}%`;
  els.progressText.textContent = `${activeProgress.percent.toFixed(1)}%`;
  els.currentComplex.textContent = job.currentComplexName || "-";
  els.crawlCounts.textContent = `${job.completedComplexes} / ${job.failedComplexes} / ${job.totalComplexes}`;
  els.crawlDelay.textContent = `${Math.round(job.delayMinMs / 1000)}-${Math.round(job.delayMaxMs / 1000)}초`;
  els.crawlTrackedJobs.innerHTML = renderCrawlJobProgress(crawl.jobProgress || []);
  els.crawlLogs.innerHTML = (crawl.logs || []).map((log) => {
    const time = new Date(log.createdAt).toLocaleTimeString("ko-KR");
    return `<div>[${time}] ${escapeHtml(log.level)} ${escapeHtml(log.message)}</div>`;
  }).join("");
}

function renderKbCoverage(items) {
  if (!els.kbCoverageGrid) return;
  if (!items.length) {
    els.kbCoverageGrid.innerHTML = `<div class="empty crawl-job-empty">지역별 수집률을 불러올 수 없습니다.</div>`;
    return;
  }

  els.kbCoverageGrid.innerHTML = items.map((item) => {
    const percent = Number(item.storedPercent || 0);
    const activeProgress = item.activeProgressPercent === null || item.activeProgressPercent === undefined
      ? null
      : Number(item.activeProgressPercent || 0);
    const latest = item.latestJob || null;
    const activeJobs = Number(item.activeJobs || 0);
    const remaining = Number(item.activePending || 0) + Number(item.activeRunning || 0);
    const latestText = latest
      ? `${crawlJobKindLabel(latest)} · ${statusLabel(latest.status)} · ${formatDateTime(latest.updatedAt || latest.createdAt)}`
      : "최근 작업 없음";
    return `
      <article class="kb-coverage-card">
        <div class="kb-coverage-head">
          <strong>${escapeHtml(item.regionName || item.regionId || "-")}</strong>
          <span>${formatInt(item.storedComplexes || 0)} / ${formatInt(item.knownTarget || item.storedComplexes || 0)}개</span>
        </div>
        <div class="kb-coverage-percent">${percent.toFixed(1)}%</div>
        <div class="kb-coverage-track" aria-hidden="true">
          <span style="width: ${Math.max(0, Math.min(percent, 100))}%"></span>
        </div>
        <div class="kb-coverage-meta">
          <span>면적 타입 ${formatInt(item.areaTypes || 0)}개</span>
          <span>대상 타일 ${formatInt(item.tileCount || 0)}개</span>
          <span>${activeJobs ? `진행 ${formatInt(activeJobs)}개 · 남음 ${formatInt(remaining)}개` : "진행 중 작업 없음"}</span>
          <span>${activeProgress === null ? "작업 진행률 -" : `작업 진행률 ${activeProgress.toFixed(1)}%`}</span>
        </div>
        <div class="kb-coverage-latest">${escapeHtml(latestText)}</div>
      </article>
    `;
  }).join("");
}

function crawlJobProgress(item) {
  const job = item.job || {};
  const counts = item.queueCounts || {};
  const completed = Number(counts.completed || 0);
  const failed = Number(counts.failed || 0);
  const done = completed + failed;
  const total = Number(job.totalComplexes || 0);
  const discovery = parseDiscoveryProgress(job.currentComplexName || "");

  if (job.status === "discovering" && discovery) {
    return {
      percent: discovery.total ? (discovery.current / discovery.total) * 100 : 0,
      label: `탐색 ${formatInt(discovery.current)} / ${formatInt(discovery.total)} 타일 · 발견 ${formatInt(discovery.found)}개`
    };
  }

  if (total) {
    return {
      percent: Number(item.progress || ((done / total) * 100)),
      label: `${formatInt(done)} / ${formatInt(total)} 단지`
    };
  }

  if (job.status === "requested") {
    return {
      percent: 0,
      label: job.sourceJobId ? "선행 작업 완료 후 대기" : "대기 중"
    };
  }

  return {
    percent: 0,
    label: "대상 준비 중"
  };
}

function parseDiscoveryProgress(value) {
  const match = String(value || "").match(/단지 탐색\s+([\d,]+)\/([\d,]+)\s*타일,\s*발견\s*([\d,]+)개/);
  if (!match) return null;
  return {
    current: Number(match[1].replaceAll(",", "")),
    total: Number(match[2].replaceAll(",", "")),
    found: Number(match[3].replaceAll(",", ""))
  };
}

function renderCrawlJobProgress(items) {
  if (!items.length) return `<div class="empty crawl-job-empty">진행 중이거나 대기 중인 주요 작업이 없습니다.</div>`;
  return items.map((item) => {
    const job = item.job;
    const counts = item.queueCounts || {};
    const failed = Number(counts.failed || 0);
    const status = job.status || "requested";
    const progress = crawlJobProgress(item);
    const activity = crawlJobActivity(item, progress);
    const label = crawlJobLabel(job);
    return `
      <article class="crawl-job-card">
        <div class="crawl-job-card-head">
          <strong>${escapeHtml(label)}</strong>
          <span class="status-pill ${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</span>
        </div>
        <div class="crawl-job-percent">${progress.percent.toFixed(1)}%</div>
        <div class="crawl-job-track" aria-hidden="true">
          <span style="width: ${Math.max(0, Math.min(progress.percent, 100))}%"></span>
        </div>
        <div class="crawl-job-meta">
          <span>${escapeHtml(progress.label)}</span>
          <span>실패 ${formatInt(failed)}</span>
        </div>
        <div class="crawl-job-activity">
          ${activity.map((line) => `<span>${escapeHtml(line)}</span>`).join("")}
        </div>
        ${job.currentComplexName ? `<div class="crawl-job-current">${escapeHtml(job.currentComplexName)}</div>` : ""}
      </article>
    `;
  }).join("");
}

function crawlJobLabel(job) {
  return `${crawlRegionLabel(job.regionId)} ${crawlJobKindLabel(job)}`;
}

function crawlJobKindLabel(job) {
  const yearsBack = Number(job?.yearsBack || 0);
  return yearsBack > 0 ? `${yearsBack}년치` : "면적정보";
}

function crawlJobActivity(item, progress) {
  const job = item.job || {};
  const recent = item.recent || {};
  const completedLastHour = Number(recent.completedLastHour || 0);
  const completedLast10Minutes = Number(recent.completedLast10Minutes || 0);
  const hourlyRate = completedLastHour;
  const lines = [
    `최근 1시간 완료 ${formatInt(completedLastHour)}개 · ${formatInt(hourlyRate)}개/시간`
  ];

  if (completedLast10Minutes) {
    lines.push(`최근 10분 ${formatInt(completedLast10Minutes)}개 · 단기속도 ${formatInt(completedLast10Minutes * 6)}개/시간`);
  }

  const topLabels = (recent.topLabels || [])
    .filter((item) => item.label)
    .map((item) => `${formatRecentLabel(item.label)} ${formatInt(item.count)}개`)
    .join(" · ");
  if (topLabels) {
    lines.push(`최근 지역 ${topLabels}`);
  }

  const discovery = parseDiscoveryProgress(job.currentComplexName || "");
  if (job.status === "discovering" && discovery && job.startedAt) {
    const elapsedHours = Math.max((Date.now() - new Date(job.startedAt).getTime()) / 3600000, 0.01);
    lines.push(`탐색 속도 ${formatInt(discovery.current / elapsedHours)}타일/시간 · 발견 ${formatInt(discovery.found / elapsedHours)}개/시간`);
  }

  if (job.status === "requested" && job.sourceJobId) {
    lines.push("선행 작업 완료 후 자동 시작");
  }

  if (progress.percent >= 100 && job.status === "completed") {
    lines.push(`최근 24시간 완료 ${formatInt(recent.completedLastDay || 0)}개`);
  }

  return lines;
}

function renderMolitStatus(status) {
  if (!status) return;
  state.latestMolitStatus = status;
  renderCollectionSummary();

  const completion = molitCompletionSummary(status);
  els.molitSummary.textContent = completion.title;
  els.molitCompletionList.innerHTML = completion.items.length
    ? completion.items.map((item) => `
      <div class="completion-item">
        <strong>${escapeHtml(item.title)}</strong>
        <span class="status-pill ${escapeHtml(item.status)}">${escapeHtml(statusLabel(item.status))}</span>
      </div>
    `).join("")
    : `<div class="empty">${escapeHtml(completion.title)}</div>`;
}

function renderMolitCoordinateAudit(audit) {
  if (!els.molitCoordinateSummary || !els.molitCoordinateRows) return;
  const overview = audit?.overview || {};
  const rows = audit?.rows || [];
  const ready = Number(overview.with_coordinates || 0);
  const total = Number(overview.complexes || 0);
  const review = Number(overview.needs_review || 0);
  const missing = Number(overview.missing_coordinates || 0);

  els.molitCoordinateSummary.textContent = `${formatInt(ready)} / ${formatInt(total)} 좌표 확보 · 점검 ${formatInt(review)}개 · 미확보 ${formatInt(missing)}개`;
  els.molitCoordinateRows.innerHTML = rows.length
    ? rows.map((row) => `
      <tr>
        <td>${row.needsReview ? `<span class="status-pill failed">점검</span>` : coordinateStatusPill(row)}</td>
        <td>
          <strong>${escapeHtml(row.aptName || "-")}</strong><br>
          <span class="muted-cell">${escapeHtml(row.legalDong || "-")}${row.jibun ? ` ${escapeHtml(row.jibun)}` : ""}</span>
        </td>
        <td>${escapeHtml(row.address || "-")}</td>
        <td>
          ${row.kbName ? `<strong>${escapeHtml(row.kbName)}</strong><br><span class="muted-cell">${escapeHtml(row.kbAddress || "-")}</span>` : "-"}
        </td>
        <td>${escapeHtml(coordinateSourceLabel(row.coordSource || row.geocodeStatus || "-"))}</td>
        <td>${row.distanceToKbM === null ? "-" : `${formatInt(row.distanceToKbM)}m`}</td>
        <td>${formatInt(row.dealCount || 0)}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="7" class="empty">점검할 좌표 차이 항목이 없습니다.</td></tr>`;
}

function renderMolitDuplicateAudit(audit) {
  if (!els.molitDuplicateSummary || !els.molitDuplicateRows) return;
  const overview = audit?.overview || {};
  const groups = audit?.groups || [];
  const hiddenGroups = Number(overview.hiddenGroupCount || 0);
  const hiddenComplexes = Number(overview.hiddenComplexCount || 0);
  const distance = Number(overview.distanceMeters || 0);
  els.molitDuplicateSummary.textContent = hiddenGroups
    ? `${formatInt(hiddenGroups)}개 그룹 · ${formatInt(hiddenComplexes)}개 숨김 · ${formatInt(distance)}m 이내`
    : "숨길 겹침 단지 없음";

  els.molitDuplicateRows.innerHTML = groups.length
    ? groups.map((group, groupIndex) => {
      const sortedItems = [...(group.items || [])].sort((a, b) =>
        duplicateActionOrder(a.action) - duplicateActionOrder(b.action)
        || String(b.lastMonth || "").localeCompare(String(a.lastMonth || ""))
        || String(a.aptName || "").localeCompare(String(b.aptName || ""), "ko")
      );
      return sortedItems.map((item, itemIndex) => `
        <tr class="${item.action === "hidden" ? "duplicate-hidden-row" : ""}">
          ${itemIndex === 0 ? `
            <td rowspan="${sortedItems.length}">
              <strong>${formatInt(groupIndex + 1)}</strong><br>
              <span class="muted-cell">${escapeHtml(group.label || "-")}</span><br>
              <span class="muted-cell">최대 ${formatInt(group.distanceMeters || 0)}m</span>
            </td>
          ` : ""}
          <td>${duplicateActionPill(item.action)}</td>
          <td>
            <strong>${escapeHtml(item.aptName || "-")}</strong><br>
            <span class="muted-cell">${item.buildYear ? `${formatInt(item.buildYear)}년 준공` : "준공년 없음"}</span>
          </td>
          <td>${escapeHtml(item.address || "-")}</td>
          <td>${formatMonthRange(item.firstMonth, item.lastMonth)}</td>
          <td>${formatInt(item.dealCount || 0)}</td>
          <td>${escapeHtml(item.reason || "-")}</td>
        </tr>
      `).join("");
    }).join("")
    : `<tr><td colspan="7" class="empty">숨김 처리된 겹침 단지가 없습니다.</td></tr>`;
}

function duplicateActionOrder(action) {
  return action === "active" ? 0 : 1;
}

function duplicateActionPill(action) {
  if (action === "hidden") return `<span class="status-pill failed">숨김</span>`;
  return `<span class="status-pill completed">표시</span>`;
}

function coordinateStatusPill(row) {
  if (row.coordStatus === "ready") return `<span class="status-pill completed">정상</span>`;
  if (row.geocodeStatus === "failed" || row.geocodeStatus === "no_result") return `<span class="status-pill failed">${escapeHtml(coordinateSourceLabel(row.geocodeStatus))}</span>`;
  return `<span class="status-pill pending">미확보</span>`;
}

function coordinateSourceLabel(value) {
  return {
    kb_match: "KB 좌표",
    naver_geocode: "네이버 지오코딩",
    geocoded: "지오코딩 완료",
    no_result: "검색결과 없음",
    failed: "지오코딩 실패",
    pending: "대기"
  }[value] || value || "-";
}

function molitCompletionSummary(status) {
  if (!status) {
    return { title: "실거래가 확인 중", items: [], isComplete: false };
  }

  const rows = status?.lawdRows || [];
  const progress = status?.progress || {};
  const completedTargets = new Set();
  const targetRows = new Map();

  for (const row of rows) {
    const target = row.target_region_id || "";
    const grouped = targetRows.get(target) || [];
    grouped.push(row);
    targetRows.set(target, grouped);
  }

  for (const [target, grouped] of targetRows.entries()) {
    if (grouped.length && grouped.every(isMolitTargetRowComplete) && molitTargetSavedCount(grouped) > 0) {
      completedTargets.add(target);
    }
  }

  const items = [];
  if (completedTargets.has("seoul")) {
    items.push({ title: "서울시 완료", status: "completed" });
  }

  if (completedTargets.has("gyeonggi")) {
    items.push({ title: "경기도 완료", status: "completed" });
  } else {
    const gyeonggiParts = ["dongtan", "bundang"].filter((target) => completedTargets.has(target));
    if (gyeonggiParts.length) {
      items.push({
        title: `경기도 ${gyeonggiParts.map(targetLabel).join("·")} 완료`,
        status: "completed"
      });
    }
  }

  for (const target of completedTargets) {
    if (!["seoul", "gyeonggi", "dongtan", "bundang"].includes(target)) {
      items.push({ title: `${targetLabel(target)} 완료`, status: "completed" });
    }
  }

  const failed = Number(progress.failed || 0);
  const running = Number(progress.running || 0);
  if (!items.length) {
    if (failed) return { title: "실거래가 수집 실패 항목 있음", items, isComplete: false };
    if (running) return { title: "실거래가 수집 중", items, isComplete: false };
    return { title: "완료된 실거래가 수집 없음", items, isComplete: false };
  }

  return {
    title: items.map((item) => item.title).join(" · "),
    items,
    isComplete: !failed && !running
  };
}

function isMolitTargetRowComplete(row) {
  const fetches = Number(row.fetches || 0);
  const completed = Number(row.completed_fetches || 0);
  const running = Number(row.running_fetches || 0);
  const failed = Number(row.failed_fetches || 0);
  return fetches > 0 && completed >= fetches && running === 0 && failed === 0;
}

function molitTargetSavedCount(rows) {
  return rows.reduce((sum, row) => sum + Number(row.saved_count || 0), 0);
}

async function loadFormulaAnalysis() {
  if (!els.formulaRunBtn) return;
  els.formulaRunBtn.disabled = true;
  els.formulaRunBtn.textContent = "분석 중";
  els.formulaSummary.textContent = "KB 시세와 실거래가 표본을 매칭 중입니다.";

  try {
    const params = new URLSearchParams();
    params.set("target", els.formulaTargetSelect.value || "seoul");
    if (els.formulaStartInput.value) params.set("start", els.formulaStartInput.value.replace("-", ""));
    if (els.formulaEndInput.value) params.set("end", els.formulaEndInput.value.replace("-", ""));
    params.set("limit", els.formulaLimitSelect.value || "15000");
    renderFormulaAnalysis(await api(`/api/formula-analysis?${params}`));
  } catch (error) {
    els.formulaSummary.textContent = `분석 실패: ${error.message}`;
  } finally {
    els.formulaRunBtn.disabled = false;
    els.formulaRunBtn.textContent = "분석";
  }
}

function renderFormulaAnalysis(result) {
  const samples = result.samples || {};
  const formulas = result.formulas || [];
  const best = formulas[0];
  els.formulaMatchedRows.textContent = formatInt(samples.matchedRows || 0);
  els.formulaTrainRows.textContent = formatInt(samples.trainRows || 0);
  els.formulaTestRows.textContent = formatInt(samples.testRows || 0);
  els.formulaBestName.textContent = best ? best.name : "-";
  els.formulaPeriod.textContent = result.period?.startMonth && result.period?.endMonth
    ? `${formatMonth(result.period.startMonth)} - ${formatMonth(result.period.endMonth)}`
    : "-";
  els.formulaSummary.textContent = result.reason
    ? result.reason
    : `KB ${formatInt(samples.kbRows || 0)}건 / 실거래 ${formatInt(samples.tradeRows || 0)}건에서 ${formatInt(samples.matchedRows || 0)}건 매칭`;

  els.formulaRows.innerHTML = formulas.length
    ? formulas.map((formula) => `
      <tr>
        <td><strong>${escapeHtml(formula.name)}</strong></td>
        <td>${escapeHtml(formula.description)}</td>
        <td>${formatDecimal(formula.scale, 3)}</td>
        <td>${formatPercentValue(formula.trainRawMape)}</td>
        <td>${formatPercentValue(formula.trainCalibratedMape)}</td>
        <td>${formatPercentValue(formula.testRawMape)}</td>
        <td class="${formula.testCalibratedMape <= 0.08 ? "positive" : ""}">${formatPercentValue(formula.testCalibratedMape)}</td>
        <td class="${Number(formula.testBias || 0) >= 0 ? "positive" : "negative"}">${formatSignedPercent(formula.testBias)}</td>
        <td>${formatInt(formula.totalCount)} / 검증 ${formatInt(formula.testCount)}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="9" class="empty">매칭된 계산식 표본이 없습니다. 수집이 더 진행된 뒤 다시 실행하세요.</td></tr>`;

  els.formulaExampleRows.innerHTML = (result.examples || []).length
    ? result.examples.map((row) => `
      <tr>
        <td>${escapeHtml(row.apartmentName)}</td>
        <td>${escapeHtml(formatPriceBandLocation(row))}</td>
        <td>${escapeHtml(row.areaLabel || "-")}</td>
        <td>${formatMonth(row.yearMonth)}</td>
        <td>${formatMoney(row.kbPyeongPrice)}</td>
        <td>${formatMoney(row.predictedPyeongPrice)}</td>
        <td>${formatInt(row.dealCount)}</td>
        <td class="${Number(row.errorRate || 0) >= 0 ? "positive" : "negative"}">${formatSignedPercent(row.errorRate)}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="8" class="empty">표시할 매칭 예시가 없습니다.</td></tr>`;
}

function applyFormulaDefaultPeriod() {
  if (!state.months.length || !els.formulaStartInput || !els.formulaEndInput) return;
  if (!els.formulaEndInput.value) {
    els.formulaEndInput.value = toMonthInput(state.months.at(-1));
  }
  if (!els.formulaStartInput.value) {
    const index = Math.max(0, state.months.length - 37);
    els.formulaStartInput.value = toMonthInput(state.months[index]);
  }
}

function statusLabel(status) {
  return {
    requested: "대기",
    discovering: "단지 탐색 중",
    completed: "완료",
    failed: "실패",
    running: "수집 중",
    pending: "대기"
  }[status] || status;
}

function crawlRegionLabel(regionId) {
  return {
    bundang: "분당",
    dongtan: "동탄",
    seoul: "서울",
    gyeonggi: "경기",
    incheon: "인천",
    busan: "부산",
    daegu: "대구",
    gwangju: "광주",
    daejeon: "대전",
    ulsan: "울산",
    sejong: "세종",
    gangwon: "강원",
    chungbuk: "충북",
    chungnam: "충남",
    jeonbuk: "전북",
    jeonnam: "전남",
    gyeongbuk: "경북",
    gyeongnam: "경남",
    jeju: "제주"
  }[regionId] || regionId || "-";
}

function formatRecentLabel(label) {
  return crawlRegionLabel(label);
}

function targetLabel(target) {
  return {
    seoul: "서울",
    gyeonggi: "경기",
    incheon: "인천",
    busan: "부산",
    daegu: "대구",
    gwangju: "광주",
    daejeon: "대전",
    ulsan: "울산",
    sejong: "세종",
    gangwon: "강원",
    chungbuk: "충북",
    chungnam: "충남",
    jeonbuk: "전북",
    jeonnam: "전남",
    gyeongbuk: "경북",
    gyeongnam: "경남",
    jeju: "제주",
    bundang: "분당",
    dongtan: "동탄"
  }[target] || target || "-";
}
