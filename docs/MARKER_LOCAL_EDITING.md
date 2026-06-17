# 마커 로컬 수정 방법

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

지역 마커 문구, 변수, 기본 크기, 디자인 탭 미리보기 샘플을 수정합니다.

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

## 템플릿 예시

`src/public/js/markers/region/config.js`의 `defaultTemplateByLevel`에서 바꿉니다.

```js
value: "{{기간}}간 상승 {{상승률}}"
```

동 마커의 시군구 순위 줄:

```js
sigungu: "{{시군구명}} {{시군구내등수}}등/{{시군구내전체}}"
```
