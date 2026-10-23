import { addMonths } from "./utils.js";

export function monthSequence(startMonth, endMonth) {
  const months = [];
  for (let month = startMonth; month <= endMonth; month = addMonths(month, 1)) {
    months.push(month);
  }
  return months;
}

export function buildMonthCodeCoverage({ months, lawdCodes, completedRows }) {
  const expectedCodes = new Set(lawdCodes.map((code) => String(code)));
  const completed = new Set(completedRows.map((row) => `${row.year_month}|${row.lawd_cd}`));
  return months.map((month) => {
    const missingLawdCodes = [...expectedCodes].filter((code) => !completed.has(`${month}|${code}`));
    return {
      month,
      status: missingLawdCodes.length ? "fail" : "pass",
      completedLawdCount: expectedCodes.size - missingLawdCodes.length,
      expectedLawdCount: expectedCodes.size,
      missingLawdCount: missingLawdCodes.length,
      missingLawdCodes
    };
  });
}
