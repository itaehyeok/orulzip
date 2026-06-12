import { initDb } from "../src/services/db.js";
import { readDatasetFromDb } from "../src/services/db-store.js";
import {
  buildApartmentRankings,
  buildNeighborhoodChart,
  buildNeighborhoodRankings,
  getAvailableMonths
} from "../src/services/price-calculator.js";

await initDb();
const dataset = await readDatasetFromDb();
const months = getAvailableMonths(dataset);
const filters = {
  regionId: dataset.apartments[0]?.regionId || "",
  start: months[Math.max(0, months.length - 13)] || "",
  end: months.at(-1) || ""
};

const neighborhoodRankings = buildNeighborhoodRankings(dataset, filters);
const apartmentRankings = buildApartmentRankings(dataset, filters);
const chart = buildNeighborhoodChart(dataset, filters);

console.log(JSON.stringify({
  counts: {
    apartments: dataset.apartments.length,
    areaTypes: dataset.areaTypes.length,
    monthlyPrices: dataset.monthlyPrices.length,
    months: months.length
  },
  filters,
  neighborhoodRows: neighborhoodRankings.rows.length,
  apartmentRows: apartmentRankings.rows.length,
  chartSeries: chart.series.length
}, null, 2));
