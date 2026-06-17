// Region marker edit zone.
// Change this file first when you want to adjust dong/sigungu/sido marker text,
// default sizes, design-preview sample data, or the style controls shown in the design tab.
window.orulzipRegionMarkerConfig = {
  levels: ["dong", "sigungu", "sido"],
  levelLabels: {
    all: "공통",
    dong: "동",
    sigungu: "시군구",
    sido: "시도"
  },
  rankLevelsByLevel: {
    dong: ["sigungu", "sido", "national"],
    sigungu: ["sido", "national"],
    sido: ["national"]
  },
  defaultDesignByLevel: {
    dong: "white",
    sigungu: "white",
    sido: "white"
  },
  defaultDisplayByLevel: {
    dong: { sigungu: true, sido: true, national: true },
    sigungu: { sido: true, national: true },
    sido: { national: true }
  },
  textByLevel: {
    dong: {
      label: ({ dongName }) => dongName,
      value: ({ growthRate }) => formatPercent(growthRate),
      rankRows: {
        sigungu: ({ sigunguName, sigunguRankText }) => `${sigunguName} ${sigunguRankText}`,
        sido: ({ sidoName, sidoRankText }) => `${sidoName} ${sidoRankText}`,
        national: ({ countryRankText }) => `전국 ${countryRankText}`
      }
    },
    sigungu: {
      // "송파구" is made here.
      label: ({ sigunguName }) => sigunguName,
      // "12.1%" is made here.
      value: ({ growthRate }) => formatPercent(growthRate),
      rankRows: {
        sido: ({ sidoName, sidoRankText }) => `${sidoName} ${sidoRankText}`,
        national: ({ countryRankText }) => `전국 ${countryRankText}`
      }
    },
    sido: {
      label: ({ sidoName }) => sidoName,
      value: ({ growthRate }) => formatPercent(growthRate),
      rankRows: {
        national: ({ countryRankText }) => `전국 ${countryRankText}`
      }
    }
  },
  designOptions: [
    { id: "white", name: "화이트 데이터칩", className: "rank-chip-white" },
    { id: "stack", name: "데이터칩 스택", className: "rank-chip-stack" },
    { id: "table", name: "미니 테이블", className: "rank-chip-table" },
    { id: "dark", name: "다크 데이터칩", className: "rank-chip-dark" }
  ],
  styleControls: [
    { key: "outerBoxWidth", label: "외부 박스 너비", group: "박스", min: 88, max: 220, step: 1 },
    { key: "rankBoxWidth", label: "순위 박스 너비", group: "박스", min: 70, max: 204, step: 1 },
    { key: "labelFontSize", label: "지역명 글자", group: "글자", min: 8, max: 18, step: 1 },
    { key: "valueFontSize", label: "상승률 글자", group: "글자", min: 16, max: 38, step: 1 },
    { key: "sigunguFontSize", label: "시군구 글자", group: "글자", min: 7, max: 17, step: 1 },
    { key: "sidoFontSize", label: "시도 글자", group: "글자", min: 7, max: 17, step: 1 },
    { key: "nationalFontSize", label: "전국 글자", group: "글자", min: 7, max: 17, step: 1 },
    { key: "rankValueFontSize", label: "등수 글자", group: "글자", min: 8, max: 18, step: 1 },
    { key: "labelRateGap", label: "지역명-상승률 간격", group: "행간", min: 0, max: 18, step: 1 },
    { key: "valueRankGap", label: "상승률-순위박스 간격", group: "행간", min: 0, max: 18, step: 1 },
    { key: "rankRowGap", label: "순위 행간", group: "행간", min: 0, max: 12, step: 1 },
    { key: "rankRowHeight", label: "순위 행 높이", group: "행간", min: 14, max: 32, step: 1 }
  ],
  defaultWidthsByDesign: {
    white: 126,
    stack: 118,
    table: 138,
    dark: 130
  },
  defaultOuterWidthByLevel: {
    sido: 110,
    sigungu: 122
  },
  defaultStyle: {
    labelFontSize: 10,
    valueFontSize: 25,
    sigunguFontSize: 9,
    sidoFontSize: 9,
    nationalFontSize: 9,
    rankValueFontSize: 10,
    labelRateGap: 5,
    valueRankGap: 5,
    rankRowGap: 4,
    tableRankRowGap: 0,
    rankRowHeight: 18
  },
  previewSamples: [
    {
      level: "sido",
      x: 63,
      y: 25,
      item: {
        name: "서울",
        sidoName: "서울",
        sidoCode: "11",
        growthRate: 0.056,
        countryRank: 4,
        countryRankTotal: 17
      }
    },
    {
      level: "sigungu",
      x: 34,
      y: 54,
      item: {
        name: "서울 강남구",
        sigunguName: "서울 강남구",
        sidoName: "서울",
        sigunguCode: "11680",
        sidoCode: "11",
        growthRate: 0.072,
        sidoRank: 16,
        sidoRankTotal: 25,
        countryRank: 118,
        countryRankTotal: 250
      }
    },
    {
      level: "dong",
      x: 70,
      y: 63,
      item: {
        name: "서울 강남구 압구정동",
        dongName: "압구정동",
        sigunguName: "서울 강남구",
        sidoName: "서울",
        sigunguCode: "11680",
        sidoCode: "11",
        growthRate: 0.094,
        sigunguRank: 3,
        sigunguRankTotal: 14,
        sidoRank: 16,
        sidoRankTotal: 425,
        countryRank: 122,
        countryRankTotal: 3500
      }
    }
  ]
};
