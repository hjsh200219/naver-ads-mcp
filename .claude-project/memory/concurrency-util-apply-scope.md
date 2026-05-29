---
name: concurrency-util-apply-scope
description: mapWithConcurrency 적용 범위 — fetch_raw_data/generate_report 순차 루프도 향후 대상
type: reference
created: 2026-05-29
---

`src/util/concurrency.ts`: `mapWithConcurrency(items, limit, fn)` — Promise.all 의미(입력순서 보존 + first-rejection) 유지하며 in-flight를 limit으로 cap. `CONCURRENT_STAT_JOBS = 8`.

- 현재 적용: weekly live fetch (server.ts fetchLiveWeeklyPayload, 28 job flat pool).
- 미적용 (architect collateral 지적, 같은 순차 패턴): `tool_fetch_raw_data` (날짜별 루프), `tool_generate_report` fetchAll (7-type × 날짜). daily fetchOne은 3 date라 무가치.

**Why:** 의존성 추가(p-limit) 대신 인라인 ~30줄 helper로 simplicity-first 충족. 동일 순차-fetch 병목이 다른 tool에도 존재.
**How to apply:** 새 순차 fetch 루프 발견 시 신규 구현 말고 mapWithConcurrency 재사용. cap 8은 Naver rate limit(429는 client retry가 흡수) 고려한 보수값 — 변경 시 429 위험. future-date skip은 task list 빌드 시 선필터, 4xx/FAILED → 빈 결과(reject 금지), 5xx → rethrow(전체 abort).

관련: [[stat-report-latency-profile]] [[naver-api-quirks]]
