import { NATIONWIDE_LAWD_CODES } from "./molit-lawd-codes.js";

// The API currently serves even 2016 transactions under the current request
// codes. Always request NATIONWIDE_LAWD_CODES, regardless of transaction month.
// The cutoff below describes already collected history, not an API/legal change
// date: the DB has complete legacy-code history through June 2026. Later legacy
// requests returned zero, so those checkpoints must never cover current codes.
export const LEGACY_MOLIT_COVERAGE_LAST_MONTH = "202606";

// Exact removed entries from the June 17 master in git d7d1d45, replaced by
// b80b050. Keep these identities separate from current trade rows; rewriting or
// recollecting completed historical aliases could duplicate existing trades.
export const LEGACY_MOLIT_LAWD_CODES = Object.freeze([
  ["28110", "인천광역시 중구"],
  ["28140", "인천광역시 동구"],
  ["28260", "인천광역시 서구"],
  ["29110", "광주광역시 동구"],
  ["29140", "광주광역시 서구"],
  ["29155", "광주광역시 남구"],
  ["29170", "광주광역시 북구"],
  ["29200", "광주광역시 광산구"],
  ["46110", "전라남도 목포시"],
  ["46130", "전라남도 여수시"],
  ["46150", "전라남도 순천시"],
  ["46170", "전라남도 나주시"],
  ["46230", "전라남도 광양시"],
  ["46710", "전라남도 담양군"],
  ["46720", "전라남도 곡성군"],
  ["46730", "전라남도 구례군"],
  ["46770", "전라남도 고흥군"],
  ["46780", "전라남도 보성군"],
  ["46790", "전라남도 화순군"],
  ["46800", "전라남도 장흥군"],
  ["46810", "전라남도 강진군"],
  ["46820", "전라남도 해남군"],
  ["46830", "전라남도 영암군"],
  ["46840", "전라남도 무안군"],
  ["46860", "전라남도 함평군"],
  ["46870", "전라남도 영광군"],
  ["46880", "전라남도 장성군"],
  ["46890", "전라남도 완도군"],
  ["46900", "전라남도 진도군"],
  ["46910", "전라남도 신안군"]
].map((entry) => Object.freeze(entry)));

const legacyAlternatives = new Map([
  ["12110", ["46110"]], ["12130", ["46130"]], ["12150", ["46150"]],
  ["12170", ["46170"]], ["12190", ["46230"]],
  ["12210", ["29110"]], ["12240", ["29140"]], ["12270", ["29155"]],
  ["12300", ["29170"]], ["12330", ["29200"]],
  ["12710", ["46710"]], ["12720", ["46720"]], ["12730", ["46730"]],
  ["12740", ["46770"]], ["12750", ["46780"]], ["12760", ["46790"]],
  ["12770", ["46800"]], ["12780", ["46810"]], ["12790", ["46820"]],
  ["12800", ["46830"]], ["12810", ["46840"]], ["12820", ["46860"]],
  ["12830", ["46870"]], ["12840", ["46880"]], ["12850", ["46890"]],
  ["12860", ["46900"]], ["12870", ["46910"]],
  // These boundary changes are groups, not a one-to-one rename. One old code
  // from the first group alone cannot prove either new district complete.
  ["28125", ["28110", "28140"]], ["28155", ["28110", "28140"]],
  ["28275", ["28260"]], ["28290", ["28260"]]
]);

function coverageAlternatives(lawdCd, yearMonth) {
  const month = String(yearMonth);
  if (!/^\d{4}(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error(`Invalid MOLIT month: ${month}; expected YYYYMM`);
  }
  const code = String(lawdCd);
  const legacy = month <= LEGACY_MOLIT_COVERAGE_LAST_MONTH ? legacyAlternatives.get(code) : null;
  return legacy ? [[code], legacy] : [[code]];
}

// completedKeys uses the store's fetchKey convention: lawdCd:yearMonth.
export function isMolitFetchComplete({ lawdCd, yearMonth, completedKeys }) {
  return coverageAlternatives(lawdCd, yearMonth).some((codes) =>
    codes.every((code) => completedKeys.has(`${code}:${yearMonth}`))
  );
}

// completedRows contains completed fetches, potentially from multiple targets.
// Missing/stale output identifies current request codes so it can drive repair.
export function buildMolitMonthCoverage({ months, completedRows, maxAgeHours = null, now = Date.now() }) {
  const completedAtByKey = new Map();
  for (const row of completedRows) {
    const key = `${row.lawd_cd}:${row.year_month}`;
    const parsed = row.completed_at ? new Date(row.completed_at).getTime() : NaN;
    const timestamp = Number.isFinite(parsed) ? parsed : null;
    const previous = completedAtByKey.get(key);
    if (previous === undefined || (timestamp ?? -Infinity) > (previous ?? -Infinity)) {
      completedAtByKey.set(key, timestamp);
    }
  }
  return months.map((month) => {
    const missingLawdCodes = [];
    const staleLawdCodes = [];
    for (const [lawdCd] of NATIONWIDE_LAWD_CODES) {
      const completeAlternatives = coverageAlternatives(lawdCd, month).filter((codes) =>
        codes.every((code) => completedAtByKey.has(`${code}:${month}`))
      );
      if (!completeAlternatives.length) {
        missingLawdCodes.push(lawdCd);
        continue;
      }
      if (maxAgeHours !== null && !completeAlternatives.some((codes) => codes.every((code) => {
        const completedAt = completedAtByKey.get(`${code}:${month}`);
        return Number.isFinite(completedAt) && now - completedAt <= maxAgeHours * 60 * 60 * 1000;
      }))) {
        staleLawdCodes.push(lawdCd);
      }
    }
    const missingLawdCount = missingLawdCodes.length + staleLawdCodes.length;
    return {
      month,
      status: missingLawdCount ? "fail" : "pass",
      completedLawdCount: NATIONWIDE_LAWD_CODES.length - missingLawdCount,
      expectedLawdCount: NATIONWIDE_LAWD_CODES.length,
      missingLawdCount,
      missingLawdCodes,
      staleLawdCodes
    };
  });
}
