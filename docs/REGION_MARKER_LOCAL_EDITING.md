# 지역 마커 로컬 수정 방법

## 로컬 서버 켜기

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

## 주로 수정할 파일

지역 마커 문구, 변수, 기본 크기, 디자인 탭 미리보기 샘플은 여기서 먼저 수정합니다.

```text
src/public/js/app-region-marker-config.js
```

실제 마커 HTML 조립 로직:

```text
src/public/js/app-marker-utils.js
```

마커 색상, 박스, 행간, 글자 배치 CSS:

```text
src/public/css/app-dong-rank-concepts.css
```

## 확인 방식

현재 앱은 저장 즉시 자동 새로고침되는 HMR 구조가 아닙니다.
VSCode에서 파일을 수정한 뒤 브라우저를 새로고침해서 확인합니다.

CSS/JS가 예전 상태로 보이면 강력 새로고침을 합니다.

```text
Mac Chrome: Cmd + Shift + R
```

## 템플릿 예시

`src/public/js/app-region-marker-config.js`의 `defaultTemplateByLevel`에서 바꿉니다.

```js
value: "{{기간}}간 상승 {{상승률}}"
```

동 마커의 시군구 순위 줄:

```js
sigungu: "{{시군구명}} {{시군구내등수}}등/{{시군구내전체}}"
```
