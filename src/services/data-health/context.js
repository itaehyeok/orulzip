import {
  DEFAULT_ACTIVE_MIN_HOUSEHOLD_COUNT,
  DEFAULT_MIN_HOUSEHOLD_COUNTS
} from "../map-growth-cache.js";
import {
  DEFAULT_PRICE_AREA_BAND_KEYS,
  DEFAULT_PRICE_BAND_MIN_HOUSEHOLD_COUNTS,
  DEFAULT_PRICE_BAND_PERIOD_MONTHS,
  PRICE_BAND_BASES
} from "../price-band-rank-cache.js";
import { NATIONWIDE_LAWD_CODES } from "../../../scripts/molit-lawd-codes.js";
import { addMonths, todayKstDateString } from "./utils.js";

export const REQUIRED_PERIOD_MONTHS = DEFAULT_PRICE_BAND_PERIOD_MONTHS;
export const REQUIRED_MAP_LEVELS = ["sido", "sigungu", "dong", "apartment"];
export const STALE_CACHE_HOURS = 36;

export function buildDataHealthContext() {
  const today = todayKstDateString();
  const endMonth = today.slice(0, 7).replace("-", "");
  return {
    today,
    endMonth,
    recentMonths: [addMonths(endMonth, -1), endMonth],
    periodMonths: REQUIRED_PERIOD_MONTHS,
    minHouseholdCounts: normalizedMinHouseholdCounts(),
    areaBandKeys: DEFAULT_PRICE_AREA_BAND_KEYS,
    priceBandBases: PRICE_BAND_BASES,
    expectedLawdCount: NATIONWIDE_LAWD_CODES.length
  };
}

export function defaultEnvironment() {
  return process.env.ORULZIP_ENVIRONMENT
    || process.env.NODE_ENV
    || process.env.PUBLIC_APP_ENV
    || "unknown";
}

function normalizedMinHouseholdCounts() {
  return [...new Set([
    ...DEFAULT_MIN_HOUSEHOLD_COUNTS,
    ...DEFAULT_PRICE_BAND_MIN_HOUSEHOLD_COUNTS,
    DEFAULT_ACTIVE_MIN_HOUSEHOLD_COUNT
  ].map((value) => Math.max(0, Math.floor(Number(value) || 0))))].sort((a, b) => a - b);
}
