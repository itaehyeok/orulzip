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
    // 동 마커 문구: 예) 태평동 / 45.5% / 수정구 1/12등 / 서울 1/59등 / 전국 42%
    dong: {
      // 마커 맨 위 지역명입니다.
      label: ({ dongName }) => dongName,
      // 가장 크게 보이는 상승률입니다.
      value: ({ growthRate }) => formatPercent(growthRate),
      // 상승률 바로 밑 괄호 문구입니다.
      valueSuffix: ({ periodLabel }) => `(${periodLabel} 상승률)`,
      // 아래 순위 박스입니다. label은 왼쪽 이름, value는 오른쪽 등수/퍼센트입니다.
      rankRows: {
        sigungu: ({ sigunguName, sigunguRankRatioText }) => ({ label: sigunguName, value: sigunguRankRatioText }),
        sido: ({ sidoName, sidoRankRatioText }) => ({ label: sidoName, value: sidoRankRatioText }),
        national: ({ countryTopPercentShort }) => ({ label: "전국", value: countryTopPercentShort })
      }
    },
    // 시군구 마커 문구: 예) 송파구 / 12.1% / 서울 12/59등 / 전국 35%
    // 전국 20등 안이면 예) 전국 12%(1등)
    sigungu: {
      // 마커 맨 위 지역명입니다. 예: 송파구
      label: ({ sigunguName }) => sigunguName,
      // 가장 크게 보이는 상승률입니다. 예: 12.1%
      value: ({ growthRate }) => formatPercent(growthRate),
      // 상승률 바로 밑 괄호 문구입니다.
      valueSuffix: ({ periodLabel }) => `(${periodLabel} 상승률)`,
      // 아래 순위 박스입니다. 시도 안에서는 등수/전체, 전국은 상위 퍼센트로 표시합니다.
      rankRows: {
        sido: ({ sidoName, sidoRankRatioText }) => ({ label: sidoName, value: sidoRankRatioText }),
        national: ({ countryTopPercentWithTopRankText }) => ({ label: "전국", value: countryTopPercentWithTopRankText })
      }
    },
    // 시도 마커 문구: 예) 경기 / 10.2% / 전국 1/10등
    sido: {
      // 마커 맨 위 지역명입니다. 예: 경기
      label: ({ sidoName }) => sidoName,
      // 가장 크게 보이는 상승률입니다.
      value: ({ growthRate }) => formatPercent(growthRate),
      // 상승률 바로 밑 괄호 문구입니다.
      valueSuffix: ({ periodLabel }) => `(${periodLabel} 상승률)`,
      // 시도 마커는 시군구 마커처럼 왼쪽에 "전국", 오른쪽에 전국 내 순위를 표시합니다.
      rankRows: {
        national: ({ countryRankRatioText }) => ({ label: "전국", value: countryRankRatioText })
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
    { key: "valuePrefixFontSize", label: "상승률 앞글자", group: "글자", min: 7, max: 18, step: 1 },
    { key: "valueFontSize", label: "상승률 글자", group: "글자", min: 16, max: 38, step: 1 },
    { key: "valueSuffixFontSize", label: "상승률 밑글자", group: "글자", min: 7, max: 18, step: 1 },
    { key: "sigunguFontSize", label: "시군구 글자", group: "글자", min: 3, max: 17, step: 1 },
    { key: "sidoFontSize", label: "시도 글자", group: "글자", min: 3, max: 17, step: 1 },
    { key: "nationalFontSize", label: "전국 글자", group: "글자", min: 3, max: 17, step: 1 },
    { key: "rankValueFontSize", label: "등수 글자", group: "글자", min: 3, max: 18, step: 1 },
    { key: "labelRateGap", label: "지역명-상승률 간격", group: "행간", min: 0, max: 18, step: 1 },
    { key: "valueSuffixGap", label: "상승률-밑글자 간격", group: "행간", min: 0, max: 12, step: 1 },
    { key: "valueRankGap", label: "상승률-순위박스 간격", group: "행간", min: 0, max: 18, step: 1 },
    { key: "rankRowGap", label: "순위 행간", group: "행간", min: 0, max: 12, step: 1 },
    { key: "rankRowHeight", label: "순위 행 높이", group: "행간", min: 14, max: 32, step: 1 },
    { key: "labelColor", label: "지역명 색상", group: "색상", type: "color" },
    { key: "valueColor", label: "상승률 색상", group: "색상", type: "color" },
    { key: "valueSuffixColor", label: "상승률 밑글자 색상", group: "색상", type: "color" }
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
    // 지역명 글자 크기입니다. 예: 송파구, 태평동, 경기
    labelFontSize: 8,
    // 상승률 위에 별도 문구를 넣을 때 쓰는 글자 크기입니다.
    valuePrefixFontSize: 9,
    // 상승률 숫자 글자 크기입니다. 예: 12.1%
    valueFontSize: 14,
    // 상승률 밑 괄호 문구 글자 크기입니다. 예: (1년 상승률)
    valueSuffixFontSize: 8,
    // 순위 박스의 라벨 글자 크기입니다. 예: 수정구
    sigunguFontSize: 8,
    // 순위 박스의 라벨 글자 크기입니다. 예: 서울
    sidoFontSize: 8,
    // 순위 박스의 라벨 글자 크기입니다. 예: 전국
    nationalFontSize: 8,
    // 순위 박스의 값 글자 크기입니다. 예: 1/12등, 35%
    rankValueFontSize: 8,
    // 지역명과 상승률 사이 간격입니다.
    labelRateGap: 5,
    // 상승률과 밑 괄호 문구 사이 간격입니다.
    valueSuffixGap: 2,
    // 상승률 묶음과 순위 박스 사이 간격입니다.
    valueRankGap: 5,
    // 순위 박스가 여러 줄일 때 줄 사이 간격입니다.
    rankRowGap: 3,
    // 미니 테이블 디자인일 때 순위 행간입니다.
    tableRankRowGap: 0,
    // 순위 박스 한 줄의 높이입니다.
    rankRowHeight: 17,
    // 지역명 색상입니다.
    labelColor: "#667085",
    // 상승률 숫자 색상입니다.
    valueColor: "#2939a8",
    // 상승률 밑 괄호 문구 색상입니다.
    valueSuffixColor: "#667085"
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
