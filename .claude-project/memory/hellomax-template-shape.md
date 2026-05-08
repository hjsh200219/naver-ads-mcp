---
name: hellomax-template-shape
description: helloMAX Report Excel 10시트 구조 + visibility 토글 규칙
type: project
created: 2026-05-08
---

# 10 시트 (생성 순서 고정)

| #   | 시트명              | Visible 조건                          |
| --- | ------------------- | ------------------------------------- |
| 1   | SUMMARY             | 항상 visible                          |
| 2   | 매체별 성과         | 항상 visible                          |
| 3   | 키워드 성과         | rawKeyword 비어있지 않으면 visible    |
| 4   | 상품 성과           | rawMaterial 비어있지 않으면 visible   |
| 5   | 검색어 성과         | rawSearchTerm 비어있지 않으면 visible |
| 6   | **브랜드검색 성과** | **항상 hidden** (placeholder)         |
| 7   | 소재RAW             | rawMaterial 비어있지 않으면 visible   |
| 8   | 검색어RAW           | rawSearchTerm 비어있지 않으면 visible |
| 9   | 일별RAW             | 항상 visible                          |
| 10  | 키워드RAW           | 항상 visible                          |

# RAW 시트 컬럼 (Korean SSOT — `src/excel/headers.ts`)

- 일별RAW (17 cols): 월별 | 주차 | 날짜 | 매체 | 캠페인유형 | 캠페인 | 광고그룹 | 디바이스 | 광고비 (VAT-) | 노출수 | 클릭수 | 구매완료 | 회원가입 | 신청완료 | 기타전환 | 전환매출액 | 평균노출순위
- 키워드RAW (18 cols): 일별RAW + `키워드` (디바이스 다음)
- 검색어RAW (18 cols): 일별RAW + `검색어`
- 소재RAW (20 cols): 일별RAW + `소재ID | 네이버 쇼핑 상품 ID | 상품명`

# 4 conversion columns 매핑

`AD_CONVERSION` reportTp의 `convTpCd`:

- 1 → 구매완료
- 2 → 회원가입
- 3 → 신청완료
- 그 외 → 기타전환

각 row의 `ccnt`는 해당 컬럼에 합산. 다른 3개는 0.

# VAT 처리

`salesAmt` 입력은 VAT 포함이라고 가정 (default `vatIncluded: true`). `광고비 (VAT-)` = `Math.round((salesAmt / 1.1) * 100) / 100` (2dp).

**Why:** helloMAX 광고주의 기존 수기 보고서 템플릿과 1:1 매핑. AE가 익숙한 컬럼명·시트명 그대로 유지.

**How to apply:** 시트 추가/삭제 금지. 컬럼 이름은 한글 그대로(공백·괄호 포함). visibility 토글은 RAW 데이터 유무 기반.
