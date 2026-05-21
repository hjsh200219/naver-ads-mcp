---
name: stat-report-column-spec
description: stat-report v2 응답 reportTp별 column 순서 — /stats API cross-check 결과 (2026-05-21)
type: project
created: 2026-05-21
---

# Stat-Report TSV column spec (v2, header 없음)

## 검증 방법

1. `scripts/sample-stat-reports.mjs`로 10개 reportTp 다운로드 (statDt=20260512, account=hellomax)
2. 5개만 데이터 있음: AD, AD_DETAIL, AD_CONVERSION, AD_CONVERSION_DETAIL, EXPKEYWORD
   - SHOPPING\_\*, BRND_CONTRACT는 hellomax 광고주에 없음 (NONE/400)
3. `scripts/verify-stat-columns.mjs`로 top-adgroup 행들의 column-sum과 동기 `/stats` API 응답 비교
4. 결과: col10/11/12/13 ↔ impCnt/clkCnt/salesAmt/avgRnk×impCnt **정확 일치**

## Cross-check 결과 (adgroup grp-a001-01-000000047351007, 2026-05-12, 715 AD rows)

| TSV col | sum    | /stats field              | match |
| ------- | ------ | ------------------------- | ----- |
| col10   | 2,969  | impCnt=2969               | ✓     |
| col11   | 4      | clkCnt=4                  | ✓     |
| col12   | 25,756 | salesAmt=25756            | ✓     |
| col13   | 10,762 | avgRnk×imp=3.6×2969≈10692 | ✓     |

## 컬럼 매핑 (검증 완료)

### AD (14 cols)

```
1: statDt           (YYYYMMDD)
2: customerId
3: nccCampaignId
4: nccAdgroupId
5: nccKeywordId
6: nccAdId
7: businessChannelId
8: _unused8         (mediaTpCode 추정 — 미검증. 27758/8753/96499 등 정수)
9: pcMblTp          ("P" or "M")
10: impCnt
11: clkCnt
12: salesAmt        (VAT 포함 여부는 별도 정책 — 기존 builder가 VAT- 변환)
13: avgRnkWeighted  (avgRnk × impCnt; 단순 avgRnk는 ÷ impCnt 필요)
14: _unused14       (sample 전부 0)
```

### AD_DETAIL (16 cols)

AD와 동일하되 col8 앞에 2개 추가 column (sub-detail codes):

```
1-7: same as AD
8: _unused8 (소규모 정수 — 미검증)
9: _unused9 (소규모 정수 — 미검증)
10: _unused10 (= AD col8; 미검증)
11: pcMblTp      (= AD col9)
12: impCnt
13: clkCnt
14: salesAmt
15: avgRnkWeighted
16: _unused16
```

### AD_CONVERSION (13 cols)

**Note**: 단 1개 sample row로 검증 (한정된 ground truth).

```
1-7: same as AD (statDt, customerId, campaignId, adgroupId, keywordId, adId, businessId)
8: _unused8 (= AD col8; 미검증)
9: pcMblTp
10: _unused10 (예: "1" — convKindCd 추정, 미검증)
11: convTpName  ("lead"/"purchase"/"signup" 등 문자열)
12: ccnt        (전환수; sample row=1)
13: convAmt     (전환매출액; sample row=0)
```

### AD_CONVERSION_DETAIL (15 cols)

AD_CONVERSION + 2개 sub-detail codes 앞에:

```
1-7: same as AD
8: _unused8 (소규모 정수 — 미검증)
9: _unused9 (소규모 정수 — 미검증)
10: _unused10 (= AD col8; 미검증)
11: pcMblTp
12: _unused12 (convKindCd 추정 — 미검증)
13: convTpName
14: ccnt
15: convAmt
```

### EXPKEYWORD (12 cols)

**주의**: AD와 numeric 컬럼 순서 다름. avgRnkWeighted가 먼저 옴.

검증 (adgroup grp-a001-01-000000047351007, 2026-05-12 EXPKEYWORD 부분합):

- col10 sum=4, /stats clkCnt=4 ✓
- col11 sum=25756, /stats salesAmt=25756 ✓
- col9 sum=1487 (부분합 — EXPKEYWORD는 검색어 단위라 전체 impCnt 2969의 부분만 포함)

```
1: statDt
2: customerId
3: nccCampaignId
4: nccAdgroupId
5: searchTerm     (검색어 문자열; nccKeywordId 없음)
6: _unused6       (mediaTpCode 추정 — 미검증)
7: pcMblTp        ("P" / "M")
8: avgRnkWeighted (avgRnk × impCnt)
9: impCnt
10: clkCnt
11: salesAmt
12: _unused12     (sample 전부 0)
```

## 미검증 reportTp (sample 미확보)

- SHOPPINGKEYWORD_DETAIL — 추정: EXPKEYWORD와 유사하되 nccKeywordId 포함할 가능성
- SHOPPINGKEYWORD_CONVERSION_DETAIL — AD_CONVERSION_DETAIL과 유사 추정
- SHOPPINGBRANDPRODUCT — productId 포함 추정
- SHOPPINGBRANDPRODUCT_CONVERSION — 위 + conv fields
- BRND_CONTRACT — hellomax에서 400 client error (이 광고주 미지원). 별도 광고주 sample 필요

**중요**: 미검증 4개는 parseTsv 매핑에서 throw UnsupportedReportTypeError로 처리. fabrication 금지.

## **Why:** 8주간 silent corruption — header 가정 버그가 모든 RAW 시트를 무효화. 인덱스 기반 매핑 + /stats cross-check로 ground truth 확정 필요.

## **How to apply:** parseTsv 리팩토링 시 이 spec을 source of truth로. 새 reportTp 추가 시 동일 검증 절차 반복 — 추측 금지.
