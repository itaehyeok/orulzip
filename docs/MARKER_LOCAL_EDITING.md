# 마커 로컬 수정 방법

## 로컬 서버 켜기

원격 firebat DB와 네이버 지도 설정을 그대로 사용해서 확인할 때:

```bash
npm run tunnel:firebat-db
```

위 터미널은 계속 켜둔 상태로 두고, 새 터미널에서:

```bash
npm run dev:firebat
```

브라우저에서:

```text
http://127.0.0.1:3065/map
http://127.0.0.1:3065/login?next=/design
```

멈출 때는 두 터미널에서 각각 `Ctrl+C`를 누릅니다.

DB 없이 화면만 확인할 때:

```bash
ORULZIP_DB_INIT=0 ORULZIP_ADMIN_PASSWORD=localtest PORT=3065 npm run dev
```

브라우저에서:

```text
http://127.0.0.1:3065/login?next=/design
```

로그인:

```text
아이디: th
비밀번호: localtest
```

## 주로 수정할 폴더

동/시군구/시도 지역 마커:

```text
src/public/js/markers/region/
src/public/css/markers/region.css
```

아파트 마커:

```text
src/public/js/markers/apartment/
src/public/css/markers/apartment.css
```

## 지역 마커 파일

```text
src/public/js/markers/region/config.js
```

지역 마커 문구, 기본 크기, 디자인 탭 미리보기 샘플을 수정합니다.

시군구 마커의 지역명과 상승률 문구는 여기부터 봅니다.

```js
sigungu: {
  label: ({ sigunguName }) => sigunguName,
  value: ({ growthRate }) => formatPercent(growthRate),
}
```

```text
src/public/js/markers/region/render.js
```

동/시군구/시도 마커 HTML 구조와 크기 계산을 수정합니다.

```text
src/public/js/markers/region/design.js
```

디자인 탭의 지역 마커 에디터 동작을 수정합니다.

```text
src/public/css/markers/region.css
```

지역 마커 색상, 박스, 행간, 글자 배치 CSS를 수정합니다.

## 아파트 마커 파일

```text
src/public/js/markers/apartment/design.js
```

디자인 탭의 아파트 마커 에디터 동작과 기본값을 수정합니다.

```text
src/public/js/markers/apartment/render.js
```

아파트 마커 HTML 구조와 크기 계산을 수정합니다.

```text
src/public/css/markers/apartment.css
```

아파트 마커 색상, 박스, 행간, 글자 배치 CSS를 수정합니다.

## 확인 방식

현재 앱은 저장 즉시 자동 새로고침되는 HMR 구조가 아닙니다.
VSCode에서 파일을 수정한 뒤 브라우저를 새로고침해서 확인합니다.

CSS/JS가 예전 상태로 보이면 강력 새로고침을 합니다.

```text
Mac Chrome: Cmd + Shift + R
```

## firebat 로컬 환경

`.env.local.firebat`은 로컬 전용 비밀 설정 파일이고 git에는 올라가지 않습니다.

이 파일은 firebat의 development 환경을 기준으로 만들되, DB 접속지는 SSH 터널의 로컬 포트로 둡니다.

```text
127.0.0.1:15432
```

네이버 지도까지 로컬에서 실제처럼 보려면 Naver Cloud Console의 Web 서비스 URL에 아래 origin이 허용되어 있어야 합니다.

```text
http://127.0.0.1:3065
http://localhost:3065
```

포트가 이미 사용 중이면 실행 중인 로컬 서버를 확인합니다.

```bash
lsof -nP -iTCP:3065 -sTCP:LISTEN
```

## 문구 수정 예시

`src/public/js/markers/region/config.js`의 `textByLevel`에서 바꿉니다.

```js
value: ({ periodLabel, growthRate }) => `${periodLabel}간 상승 ${formatPercent(growthRate)}`
```

동 마커의 시군구 순위 줄:

```js
sigungu: ({ sigunguName, sigunguRank, sigunguRankTotal }) => `${sigunguName} ${sigunguRank}등/${sigunguRankTotal}`
```
