export const regions = [
  {
    id: "bundang",
    name: "분당",
    bbox: {
      startLat: 37.335,
      endLat: 37.425,
      startLng: 127.065,
      endLng: 127.185
    },
    tileSize: 0.015
  },
  {
    id: "dongtan",
    name: "동탄",
    bbox: {
      startLat: 37.155,
      endLat: 37.245,
      startLng: 127.035,
      endLng: 127.16
    },
    tileSize: 0.015
  },
  {
    id: "seoul",
    name: "서울",
    bbox: {
      startLat: 37.42,
      endLat: 37.7,
      startLng: 126.76,
      endLng: 127.2
    },
    tileSize: 0.015
  }
];

export function getRegion(regionId) {
  return regions.find((region) => region.id === regionId);
}

export function listTiles(region) {
  const tiles = [];
  const step = region.tileSize;
  const centerLat = (region.bbox.startLat + region.bbox.endLat) / 2;
  const centerLng = (region.bbox.startLng + region.bbox.endLng) / 2;

  for (let lat = region.bbox.startLat; lat < region.bbox.endLat; lat += step) {
    for (let lng = region.bbox.startLng; lng < region.bbox.endLng; lng += step) {
      tiles.push({
        startLat: roundCoord(lat),
        endLat: roundCoord(Math.min(lat + step, region.bbox.endLat)),
        startLng: roundCoord(lng),
        endLng: roundCoord(Math.min(lng + step, region.bbox.endLng))
      });
    }
  }

  return tiles.sort((a, b) => {
    const aDistance = distanceToCenter(a, centerLat, centerLng);
    const bDistance = distanceToCenter(b, centerLat, centerLng);
    return aDistance - bDistance;
  });
}

function roundCoord(value) {
  return Number(value.toFixed(7));
}

function distanceToCenter(tile, centerLat, centerLng) {
  const tileLat = (tile.startLat + tile.endLat) / 2;
  const tileLng = (tile.startLng + tile.endLng) / 2;
  return Math.abs(tileLat - centerLat) + Math.abs(tileLng - centerLng);
}
