---
name: parsetsv-header-bug
description: parseTsv가 네이버 v2 응답 첫 줄을 header로 가정 — 실제로는 header 없는 raw data라 모든 RAW 시트 silent corruption
type: project
created: 2026-05-21
---

# parseTsv 헤더 corruption

## 사실 (실측 2026-05-21)

네이버 Search Ad API stat-report 다운로드 응답 (fileVersion=v2)은 **header 없이 raw data부터 시작**.

실측 첫 줄 (AD/20260519):

```
20260519	3371736	cmp-a001-01-000000008971922	grp-a001-01-000000047351007	...	14컬럼
```

→ 첫 토큰부터 데이터 (날짜 + customerId + 캠페인ID).

## 현재 버그

[src/api/stat-reports.ts:131-150](src/api/stat-reports.ts#L131-L150)의 `parseTsv`가 첫 줄을 **header로 가정**:

```ts
const headers = nonEmpty[0]!.split("\t").map((h) => h.trim());
```

결과:

- 첫 row가 키로 잘못 사용됨 (`"20260519"`, `"3371736"`, `"cmp-..."`)
- 나머지 row들은 named access(`o.statDt`, `o.nccCampaignId`)로 접근 → undefined
- xlsx는 만들어지지만 모든 RAW 시트가 `'unknown'` / `'NaN-NaN'` / `Invalid Date`로 가득

## 영향

- `fetch_raw_data`: 응답 key가 의미 없는 데이터
- `generate_report`: xlsx 만들어지지만 일별RAW/키워드RAW/검색어RAW/소재RAW 전부 무효 내용
- `prepare_weekly_dashboard` (3-tool): helloMAX form xlsx 파싱 경로만 쓰면 영향 없음

## 수정 방향

1. Naver Search Ad API 공식 docs에서 각 reportTp별 column 순서 정의 확인
2. parseTsv를 index-based로 변경 (`string[][]` 또는 `Record<number, string>`)
3. raw builder들(daily/keyword/search-term/material)이 column index → 의미 매핑하도록 수정
4. fixture/test 재작성

## **Why:** 8주간 silent failure였음. xlsx는 정상 생성되어서 발견 못함. catch-swallow가 stat-reports 다운로드 버그를 가렸고, 그 버그 수정 후에야 parseTsv 문제가 드러남.

## **How to apply:** stat-reports 관련 작업 시 가장 먼저 다뤄야 함. parseTsv 수정 없이 raw builder 추가 작업은 무의미.
