---
name: weekly-live-api-path
description: prepare_weekly_payload는 xlsx form 없이 ISO week만으로 자동 실행 가능 (live API fallback)
type: project
created: 2026-05-21
---

# Weekly Live API Path (commit a2fa57a)

## 문제

기존: `prepare_weekly_payload`는 **반드시 `xlsxPath` 필수** (사용자가 helloMAX form을 미리 생성해야 함).
불편함: form 생성 → 서버에 업로드 → tool 호출의 3단계. 자동화 불가.

## 해결책

commit a2fa57a: **xlsxPath 생략 시 live API 자동 경로 추가**

```typescript
// src/mcp/server.ts — prepare_weekly_payload
if (!xlsxPath) {
  // xlsxPath 없으면 ISO week → live API 자동 fetch
  const monday = isoWeekToMonday(week);
  const sunday = addDays(monday, 6);
  const dailyRows = await client.fetchRawData(account, {
    startDate: formatYmd(monday),
    endDate: formatYmd(sunday),
    includeTypes: ["AD", "AD_CONVERSION"],
  });
  const weeklyData = buildDailyRaw(dailyRows).then((rows) =>
    aggregateWeeklyPayload(rows, week),
  );
  payload = weeklyData;
} else {
  // 기존: xlsxPath 입력 시 form 파싱
  payload = await loadXlsxPayload(xlsxPath);
}
```

## 동작

1. **입력**: `prepare_weekly_payload({client: 'acme', week: '2026-W21'})`
2. **내부 처리**:
   - ISO week → Monday (2026-05-19) 계산 (`isoWeekToMonday`)
   - 14일치 (Mon～Sun) AD + AD_CONVERSION 다운로드
   - `buildDailyRaw` → `aggregateWeeklyPayload` → weekly 집계
3. **출력**: `{payload: PrecomputedPayload, payload_summary_md: string}` (form 입력과 동일 서명)

## 전환 4 카테고리

`buildDailyRaw`는 `AD_CONVERSION` stat-report의 `convTp` 필드를 분류:

- `searchKeywordClicks` → `keyword_search`
- `adClicks` → `ad_search`
- `brandSearchClicks` → `brand_search` (NCP 미제공 케이스)
- `shoppingClicks` → `shopping` (이커머스)

각 카테고리는 `classifyConvTp` 로직으로 매핑. 브랜드검색은 placeholder (API 비지원).

## Trade-off

**장점:**

- form 업로드 + manual 단계 제거 → 자동화 가능 (매일/매주 스케줄링)
- 두 경로 모두 동일 `PrecomputedPayload` 스키마

**제약:**

- live 경로는 **형식 커스터마이징 불가** (form은 AE가 직접 수정 가능)
- 브랜드검색 영역별 성과는 API 미지원이므로 live 경로도 placeholder

## 검증 (commit a2fa57a)

- `tests/prepare-weekly-dashboard.test.ts`: "does not throw (live fallback)" — xlsxPath 없어도 정상 실행
- `tests/dates.test.ts`: `isoWeekToMonday`, `toYmdCompact`, `addDays` 8 case
- vitest: 354/354 passing

## Do's & Don'ts

- ✓ xlsxPath 생략해서 live API 경로 트리거
- ✓ 매주 자동 실행: `prepare_weekly_payload({client, week})` only
- ✓ week는 ISO 8601 형식 (2026-W21, W01～W53)
- ✗ xlsxPath + form 커스터마이징 경로와 혼용 (pick one per workflow)
- ✗ 브랜드검색 영역별 성과 기대 (API 미제공, live/form 모두 동일)

관련: [[config-single-source-principle]], [[weekly-dashboard-3tool-flow]], [[stat-report-column-spec]].
