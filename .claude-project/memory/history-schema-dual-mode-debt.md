---
name: history-schema-dual-mode-debt
description: HistoryEntrySchema의 week 필드가 YYYY-Www(주간)와 YYYY-MM-DD(데일리) 두 포맷을 모두 허용하는 것은 의도적 단기 타협이며 분리가 예정된 기술 부채
type: project
created: 2026-05-11
---

**현 상태**: `src/output/types.ts`(또는 동등 위치)의 `HistoryEntrySchema`에서 `week` 필드는 `YYYY-Www`(주간) 또는 `YYYY-MM-DD`(데일리) 두 포맷을 모두 허용한다. `html_path`/`xlsx_path`는 데일리 엔트리에서 빈 문자열을 허용하고, `status` enum에 `daily_prepared`가 추가됐다.

**Why:** 데일리 prepare 기능을 신속하게 통합하는 과정에서 기존 주간 스키마를 확장하는 것이 최소 변경 경로였다. Architect 검토에서 단기 허용으로 승인됐으나 데일리 엔트리가 늘어나면 별도 스키마로 분리해야 한다는 조건부 승인.

**How to apply:**

- 새 history 관련 기능 추가 시, `week` 필드의 dual-format이 허용하는 포맷에 맞는지 확인.
- 데일리 엔트리가 독자적인 필드를 필요로 하거나 현재 스키마가 분기 로직으로 복잡해지면, `DailyHistoryEntrySchema`를 별도로 정의하고 union type으로 분리할 것.
- 이 스키마를 파싱하는 코드에서 `week` 포맷으로 주간/데일리를 구분할 때 regex 확인: `YYYY-Www` → 주간, `YYYY-MM-DD` → 데일리.
- 분리 트리거: 데일리 전용 필드가 3개 이상 추가되거나 status enum에 daily\_ prefix가 3개 이상 누적될 때.
