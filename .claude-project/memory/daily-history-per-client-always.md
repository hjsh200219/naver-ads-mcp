---
name: daily-history-per-client-always
description: prepare_daily_dashboard는 violation_count와 무관하게 매핑된 광고주당 1건 history 기록 (commit f0442ed 이후, audit trail 우선)
type: project
created: 2026-05-11
---

# prepare_daily_dashboard history write semantics

## 결정 (commit f0442ed 이후)

`prepare_daily_dashboard` 도구는 호출 1회당 **매핑된 광고주마다 정확히 1건**의 history entry를 기록한다. `violation_count`(0건 clean 포함)와 무관하게 항상 기록.

## Rationale

- **Audit trail > noise reduction**: 운영팀이 "이 광고주는 오늘 점검됐는가?"를 단일 history 조회로 답해야 함.
- PRD US-020 AC: "writes one entry per client" — clean-path도 포함됨.
- noise 우려는 history viewer 측 필터링 (status === "clean" 숨기기 등) 으로 해결.

## 이전 동작 (regression)

`if (violations.length > 0) await history.appendHistory(...)` 가드 때문에 clean 광고주는 skip → "오늘 점검 했는데 기록이 없네?" 혼선 발생.

## 회귀 방지

- `tests/mcp/daily-history.test.ts` 에서 clean-path 시나리오의 `appendHistory` 호출 횟수를 명시 단언.
- 새로운 dashboard tool 추가 시 동일 카디널리티 정책 (per-client × 1) 채택 여부 결정.

## 관련

- `prd-vs-impl-drift-clean-path-test.md` — drift 발생 패턴 (feedback)
- `history-schema-dual-mode-debt.md` — week 필드 dual-mode (daily/weekly)
- `weekly-report-automation-plan.md` — 주간 리포트도 같은 per-client 정책
