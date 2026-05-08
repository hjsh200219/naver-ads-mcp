# Core Beliefs — Naver Ads MCP

## 1. 공식 API 우선

Naver Search Ad API를 최우선으로 사용. Web 자동화(Playwright, Puppeteer 등)는 이용약관(ToS) 회색지대이며 봇 탐지 리스크가 있어 **최후수단**으로만 허용.

**실제 사례**: 브랜드검색 영역별 성과 데이터 — API 미지원이므로 자동화 불가, hidden placeholder로 처리.
(참조: [naver/searchad-apidoc#1072](https://github.com/naver/searchad-apidoc/issues/1072))

## 2. 자격증명 안전을 코드 구조로 강제

자격증명 보호는 "규칙"이 아닌 **코드 구조**로 강제:

- `enumerable: false` — `JSON.stringify`, `console.log`에서 값 누출 방지
- `.gitignore` 등록 — `.env` 커밋 불가
- 에러 메시지 마스킹 — `NaverAdsApiError`에 자격증명 값 미포함
- SECRET_KEY 비전송 — HMAC 서명 생성에만 사용

신뢰는 사람이 아닌 구조에 맡긴다.

## 3. RAW 데이터 보존: No AI Math

API 응답을 클라이언트(TypeScript)에서 집계하고, **LLM은 계산하지 않는다**.

- RAW 시트: API 응답 원본 (17-20 컬럼 한글 헤더)
- PIVOT 시트: TypeScript 코드로 집계 (재현 가능)
- LLM은 집계 결과를 해석·설명하는 역할만

부동소수점 오류, 비재현 계산, 감사 불가능한 숫자는 허용하지 않는다.

## 4. helloMAX 템플릿과의 1:1 시트 매핑 유지

Excel 보고서는 helloMAX 10시트 템플릿과 **1:1로 매핑**:

| 시트              | 내용                  | 자동화                          |
| ----------------- | --------------------- | ------------------------------- |
| RAW-캠페인        | 캠페인별 일별 성과    | ✓                               |
| RAW-매체          | 매체×캠페인 교차 성과 | ✓                               |
| RAW-키워드        | 키워드별 성과         | ✓                               |
| RAW-소재          | 소재별 성과           | ✓                               |
| SUMMARY           | 전체 요약             | ✓                               |
| 매체별            | 매체 피벗             | ✓                               |
| 키워드            | 키워드 피벗           | ✓                               |
| 상품              | 상품 피벗             | ✓                               |
| 검색어            | 검색어 피벗           | ✓                               |
| 브랜드검색 영역별 | 영역별 성과           | hidden placeholder (API 미지원) |

템플릿이 변경되면 `src/excel/headers.ts` (SSOT) 업데이트 필수.

## 5. TDD 우선: 153 tests로 153 시나리오 잠금

현재 153개 테스트가 핵심 시나리오를 커버. 새 기능은 **실패하는 테스트 먼저** 작성해야 이 잠금에 추가된다.

테스트 없는 기능 추가는 "발견하기 전까지 동작"이 아닌 "발견 즉시 회귀"를 의미.
