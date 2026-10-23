import { addMonths } from "./utils.js";

export function monthSequence(startMonth, endMonth) {
  const months = [];
  for (let month = startMonth; month <= endMonth; month = addMonths(month, 1)) {
    months.push(month);
  }
  return months;
}

export function buildMonthCodeCoverage({ months, lawdCodes, completedRows, maxAgeHours = null, now = Date.now() }) {
  const expectedCodes = new Set(lawdCodes.map((code) => String(code)));
  const completedAtByKey = new Map();
  for (const row of completedRows) {
    const key = `${row.year_month}|${row.lawd_cd}`;
    const timestamp = row.completed_at ? new Date(row.completed_at).getTime() : null;
    const previous = completedAtByKey.get(key);
    if (previous === undefined || (timestamp ?? -Infinity) > (previous ?? -Infinity)) {
      completedAtByKey.set(key, timestamp);
    }
  }
  return months.map((month) => {
    const missingLawdCodes = [];
    const staleLawdCodes = [];
    for (const code of expectedCodes) {
      const key = `${month}|${code}`;
      if (!completedAtByKey.has(key)) {
        missingLawdCodes.push(code);
        continue;
      }
      const completedAt = completedAtByKey.get(key);
      if (maxAgeHours !== null && (!Number.isFinite(completedAt) || now - completedAt > maxAgeHours * 60 * 60 * 1000)) {
        staleLawdCodes.push(code);
      }
    }
    const incompleteLawdCount = missingLawdCodes.length + staleLawdCodes.length;
    return {
      month,
      status: incompleteLawdCount ? "fail" : "pass",
      completedLawdCount: expectedCodes.size - incompleteLawdCount,
      expectedLawdCount: expectedCodes.size,
      missingLawdCount: incompleteLawdCount,
      missingLawdCodes,
      staleLawdCodes
    };
  });
}
