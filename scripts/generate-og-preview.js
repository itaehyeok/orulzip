import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";

const outputPath = resolve("src/public/og/orulzip-map-preview.png");
const width = 1200;
const height = 630;

const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <style>
      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        width: ${width}px;
        height: ${height}px;
        overflow: hidden;
        font-family: Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
        color: #172033;
        background: #f4f8fb;
      }

      .preview {
        position: relative;
        width: ${width}px;
        height: ${height}px;
        padding: 58px 70px;
        background:
          linear-gradient(90deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.94) 43%, rgba(245, 250, 253, 0.84) 100%),
          #f4f8fb;
      }

      .map-lines {
        position: absolute;
        inset: 0;
        width: ${width}px;
        height: ${height}px;
      }

      .brand {
        position: relative;
        z-index: 2;
        display: flex;
        align-items: center;
        gap: 15px;
        font-size: 36px;
        font-weight: 900;
        letter-spacing: 0;
      }

      .brand-mark {
        display: grid;
        place-items: center;
        width: 64px;
        height: 64px;
        border-radius: 16px;
        background: #eef4fb;
      }

      .brand-mark svg {
        width: 46px;
        height: 46px;
      }

      .brand-mark .logo-stroke {
        stroke: #172033;
        stroke-width: 4.6;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .brand-mark .logo-accent {
        stroke: #1aa56b;
        stroke-width: 4.6;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .copy {
        position: relative;
        z-index: 2;
        width: 535px;
        margin-top: 54px;
      }

      h1 {
        margin: 0;
        font-size: 72px;
        line-height: 1.08;
        letter-spacing: 0;
        font-weight: 900;
      }

      .subtitle {
        margin-top: 25px;
        color: #475569;
        font-size: 28px;
        line-height: 1.46;
        font-weight: 700;
      }

      .chips {
        display: flex;
        gap: 12px;
        margin-top: 35px;
      }

      .chip {
        display: inline-flex;
        align-items: center;
        height: 45px;
        padding: 0 18px;
        border: 2px solid #dce6f2;
        border-radius: 999px;
        background: #fff;
        color: #344256;
        font-size: 21px;
        font-weight: 800;
      }

      .rate {
        color: var(--rate-color);
      }

      .map-panel {
        position: absolute;
        top: 61px;
        right: 57px;
        width: 579px;
        height: 500px;
        border: 1px solid rgba(201, 214, 230, 0.86);
        border-radius: 22px;
        background: rgba(255, 255, 255, 0.74);
        box-shadow: 0 28px 70px rgba(24, 39, 75, 0.16);
        overflow: hidden;
      }

      .map-panel::before {
        content: "";
        position: absolute;
        inset: 0;
        background:
          radial-gradient(circle at 70% 26%, rgba(26, 165, 107, 0.13) 0 104px, transparent 106px),
          radial-gradient(circle at 30% 78%, rgba(37, 99, 235, 0.10) 0 128px, transparent 130px);
      }

      .period {
        position: absolute;
        top: 24px;
        right: 24px;
        z-index: 2;
        display: flex;
        align-items: center;
        height: 55px;
        padding: 0 22px;
        border: 1px solid #dce6f2;
        border-radius: 999px;
        background: #fff;
        color: #172033;
        font-size: 24px;
        font-weight: 900;
      }

      .marker {
        position: absolute;
        z-index: 2;
        width: 148px;
        padding: 13px 12px 12px;
        border: 4px solid var(--rate-color);
        border-radius: 12px;
        background: #fff;
        text-align: center;
        box-shadow: 0 12px 28px rgba(24, 39, 75, 0.14);
      }

      .marker .area {
        color: #667085;
        font-size: 17px;
        font-weight: 900;
      }

      .marker .value {
        margin-top: 4px;
        color: var(--rate-color);
        font-size: 35px;
        line-height: 1;
        font-weight: 950;
      }

      .marker .label {
        margin-top: 3px;
        color: #5d6b80;
        font-size: 15px;
        font-weight: 900;
      }

      .marker .rank {
        display: inline-flex;
        align-items: center;
        height: 29px;
        margin-top: 10px;
        padding: 0 11px;
        border-radius: 999px;
        background: var(--rank-bg);
        color: var(--rate-color);
        font-size: 16px;
        font-weight: 950;
      }

      .marker.red {
        --rate-color: #dc2626;
        --rank-bg: #fee2e2;
        top: 132px;
        left: 345px;
      }

      .marker.orange {
        --rate-color: #d97706;
        --rank-bg: #ffedd5;
        top: 258px;
        left: 224px;
      }

      .marker.green {
        --rate-color: #16a34a;
        --rank-bg: #dcfce7;
        top: 342px;
        left: 382px;
      }

      .marker.blue {
        --rate-color: #2563eb;
        --rank-bg: #dbeafe;
        top: 207px;
        left: 65px;
      }

      .url {
        position: absolute;
        right: 70px;
        bottom: 43px;
        z-index: 3;
        color: #64748b;
        font-size: 21px;
        font-weight: 800;
      }
    </style>
  </head>
  <body>
    <section class="preview">
      <svg class="map-lines" viewBox="0 0 ${width} ${height}" fill="none" aria-hidden="true">
        <path d="M705 2C678 91 655 152 610 214C558 286 495 308 443 366C394 421 385 492 383 632" stroke="#cbd5e1" stroke-width="12"/>
        <path d="M727 0C700 95 677 164 628 228C576 296 513 325 465 378C421 426 411 500 409 632" stroke="#ffffff" stroke-width="7"/>
        <path d="M587 82C675 117 752 125 831 107C921 86 999 101 1200 194" stroke="#f6c56c" stroke-width="15"/>
        <path d="M587 82C675 117 752 125 831 107C921 86 999 101 1200 194" stroke="#fff1c7" stroke-width="8"/>
        <path d="M652 492C725 442 791 415 867 409C972 400 1040 447 1200 452" stroke="#f6c56c" stroke-width="15"/>
        <path d="M652 492C725 442 791 415 867 409C972 400 1040 447 1200 452" stroke="#fff1c7" stroke-width="8"/>
        <path d="M553 327C632 321 690 295 762 265C871 219 976 224 1200 303" stroke="#95c6ea" stroke-width="18"/>
        <path d="M553 327C632 321 690 295 762 265C871 219 976 224 1200 303" stroke="#bfe3fa" stroke-width="10"/>
        <path d="M645 36L1200 618" stroke="#d8e1ea" stroke-width="4"/>
        <path d="M568 177L1117 630" stroke="#d8e1ea" stroke-width="4"/>
        <path d="M769 0L1200 378" stroke="#d8e1ea" stroke-width="4"/>
        <path d="M516 514L1082 104" stroke="#d8e1ea" stroke-width="4"/>
        <path d="M492 246L1117 37" stroke="#d8e1ea" stroke-width="4"/>
        <path d="M748 630L1200 202" stroke="#d8e1ea" stroke-width="4"/>
      </svg>

      <div class="brand">
        <span class="brand-mark">
          <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <path class="logo-stroke" d="M8 25 24 11l16 14"/>
            <path class="logo-stroke" d="M15 42V29"/>
            <path class="logo-stroke" d="M33 42V29"/>
            <path class="logo-accent" d="M18 34l6-7 4 4 7-11"/>
          </svg>
        </span>
        <span>오를집</span>
      </div>

      <div class="copy">
        <h1>아파트 실거래가<br>상승률 지도</h1>
        <p class="subtitle">국토부 실거래가로 지역별 상승률과 아파트 랭킹을 한눈에 확인하세요.</p>
        <div class="chips">
          <span class="chip">실거래가</span>
          <span class="chip">상승률 지도</span>
          <span class="chip">아파트 랭킹</span>
        </div>
      </div>

      <div class="map-panel">
        <div class="period">1년 전 대비</div>
        <div class="marker red">
          <div class="area">송파구</div>
          <div class="value">26.1%</div>
          <div class="label">(1년 상승률)</div>
          <div class="rank">서울 1/25등</div>
        </div>
        <div class="marker orange">
          <div class="area">마포구</div>
          <div class="value">15.7%</div>
          <div class="label">(1년 상승률)</div>
          <div class="rank">서울 9/25등</div>
        </div>
        <div class="marker green">
          <div class="area">금천구</div>
          <div class="value">2.5%</div>
          <div class="label">(1년 상승률)</div>
          <div class="rank">서울 25/25등</div>
        </div>
        <div class="marker blue">
          <div class="area">시흥시</div>
          <div class="value">-1.5%</div>
          <div class="label">(1년 상승률)</div>
          <div class="rank">경기 39/47등</div>
        </div>
      </div>

      <div class="url">orulzip.com</div>
    </section>
  </body>
</html>`;

await mkdir(dirname(outputPath), { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1
  });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.screenshot({
    path: outputPath,
    type: "png",
    clip: { x: 0, y: 0, width, height }
  });
  console.log(`Generated ${outputPath}`);
} finally {
  await browser.close();
}
