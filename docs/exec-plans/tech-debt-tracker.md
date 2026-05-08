# Tech Debt Tracker — Naver Ads MCP

## 현황 요약

| #   | 부채 항목                                                 | 심각도 | 상태      | Phase        |
| --- | --------------------------------------------------------- | ------ | --------- | ------------ |
| 1   | validate_credentials 비-NaverAdsApiError 케이스 단일화    | 낮음   | 미해소    | Phase 4      |
| 2   | AD_CONVERSION_DETAIL 45일 한계 — 일일 누적 저장 미구현    | 중간   | 미해소    | Phase 4      |
| 3   | 브랜드검색 영역별 성과 자동화 미구현                      | 낮음   | 설계 보류 | Phase 6 후보 |
| 4   | Excel writer PivotSheetLike 인터페이스 동기화 책임 미명시 | 낮음   | 미해소    | Phase 4      |

---

## 상세

### #1 validate_credentials의 비-NaverAdsApiError 케이스

**위치**: `src/mcp/server.ts` 또는 `src/api/client.ts`

**문제**: `validate_credentials` tool 실행 시, `NaverAdsApiError`가 아닌 네트워크 오류(DNS 실패, timeout 등)가 발생하면 "Network or unknown error"로 단일화되어 디버깅이 어려움.

**발견 경위**: architect-review-r2.md nit 항목 잔여

**제안 해결**: catch 블록에서 `err instanceof NaverAdsApiError` 분기 후, 그 외 에러는 `err.message`를 포함한 구체적 메시지 throw.

**영향 범위**: `tests/mcp/` 1-2개 테스트 업데이트 필요

---

### #2 AD_CONVERSION_DETAIL 45일 보관 한계

**위치**: Naver API 제약 (코드 변경 불가)

**문제**: `AD_CONVERSION_DETAIL` 보고서 타입은 Naver 서버에서 45일치만 보관. 45일 이전 데이터는 API로 조회 불가.

**영향**: 월간/분기 전환 추세 분석 불가. 장기 보고서 생성 시 데이터 누락.

**제안 해결**: 매일 cron 스크립트로 전날 데이터를 로컬 파일 또는 S3에 누적 저장. 현재 MCP server는 on-demand만 지원.

**현재 상태**: 미구현. 운영자가 수동으로 매일 실행하는 것으로 우회 중.

---

### #3 브랜드검색 영역별 성과 자동화

**위치**: `src/excel/writer.ts` (현재 hidden placeholder)

**문제**: Naver Search Ad API가 브랜드검색 영역별(PC/모바일 × 파워링크/쇼핑 등) 성과 데이터를 미지원.
(참조: [naver/searchad-apidoc#1072](https://github.com/naver/searchad-apidoc/issues/1072))

**설계 상태**: Playwright를 통한 웹 자동화는 ToS 회색지대 + 봇 탐지 리스크로 보류.

**현재 처리**: Excel 10번째 시트를 hidden placeholder로 생성. AE가 수동 입력.

**Phase 6 재검토 조건**: Naver API가 해당 데이터를 공식 지원하거나, ToS 명확화 시.

---

### #4 Excel writer PivotSheetLike 인터페이스 동기화

**위치**: `src/excel/writer.ts`, `src/pivot/types.ts`

**문제**: `writer.ts`에서 사용하는 `PivotSheetLike` 구조적 인터페이스(duck typing)와 `pivot/types.ts`의 실제 타입 간 동기화 책임이 명시되지 않음. 향후 pivot 타입 변경 시 writer가 조용히 깨질 수 있음.

**제안 해결**: `PivotSheetLike`를 `pivot/types.ts`에서 export하거나, 명시적 `satisfies` 타입 검사 추가.

**영향**: TypeScript strict 모드에서 현재는 탐지 가능하나, 구조적 호환성 변경 시 런타임 오류 가능.
