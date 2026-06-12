import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..", "..");
const cacheFile = join(rootDir, "data", "cache", "dataset.json");

export function emptyDataset() {
  return {
    meta: {
      source: "kb_internal_mvp",
      syncedAt: null,
      regions: {}
    },
    apartments: [],
    areaTypes: [],
    monthlyPrices: []
  };
}

export async function readDataset() {
  try {
    return JSON.parse(await readFile(cacheFile, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return emptyDataset();
    throw error;
  }
}

export async function writeDataset(dataset) {
  await mkdir(dirname(cacheFile), { recursive: true });
  await writeFile(cacheFile, `${JSON.stringify(dataset, null, 2)}\n`);
}

export async function mergeRegionDataset(regionId, incoming) {
  const current = await readDataset();

  const regionApartmentIds = new Set(
    current.apartments
      .filter((apartment) => apartment.regionId === regionId)
      .map((apartment) => apartment.id)
  );
  const regionAreaTypeIds = new Set(
    current.areaTypes
      .filter((areaType) => regionApartmentIds.has(areaType.apartmentId))
      .map((areaType) => areaType.id)
  );

  current.apartments = current.apartments.filter((apartment) => apartment.regionId !== regionId);
  current.areaTypes = current.areaTypes.filter((areaType) => !regionApartmentIds.has(areaType.apartmentId));
  current.monthlyPrices = current.monthlyPrices.filter((price) => !regionAreaTypeIds.has(price.areaTypeId));

  current.apartments.push(...incoming.apartments);
  current.areaTypes.push(...incoming.areaTypes);
  current.monthlyPrices.push(...incoming.monthlyPrices);
  current.meta.source = "kb_internal_mvp";
  current.meta.syncedAt = new Date().toISOString();
  current.meta.regions[regionId] = incoming.meta;

  await writeDataset(current);
  return current;
}

