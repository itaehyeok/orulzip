// Only these reviewed pools may be queried; client input never becomes a DB scope.
const areas = [
  { id: "songpa", label: "송파파인타운", description: "송파파인타운 인접 단지", snapshot: "neighborhood-lab-snapshot.json", referenceId: "kb:15699" },
  { id: "dongtan-station", label: "동탄역 주변", description: "동탄역 주변 반경 1.5km 발췌 단지", snapshot: "neighborhood-lab-dongtan-station.json", referenceId: "kb:39797" },
  { id: "dongtan-mokdong", label: "동탄 목동", description: "화성 동탄 목동 법정동 발췌 단지", snapshot: "neighborhood-lab-dongtan-mokdong.json", referenceId: "kb:30364" }
];

export const neighborhoodAreas = areas.map(({ id, label }) => ({ id, label }));

export function getNeighborhoodArea(id = "songpa") {
  const area = areas.find(item => item.id === id);
  if (!area) {
    const error = new Error("지원하지 않는 지역입니다."); error.statusCode = 400; throw error;
  }
  return area;
}
