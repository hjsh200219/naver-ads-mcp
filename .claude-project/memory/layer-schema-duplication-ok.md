---
name: layer-schema-duplication-ok
description: L4가 L2 스키마를 재선언하는 duplication은 레이어 방향 위반 방지를 위해 의도적으로 허용된 패턴
type: project
created: 2026-05-11
---

**사례**: `src/config/client-mappings.ts`(L4)의 `per-client daily_thresholds` 필드는 `src/analyzer/thresholds.ts`(L2) `ThresholdConfigSchema`의 3개 필드를 그대로 재선언한다. L4가 L2를 import하면 의존 방향(L1←L2←L3←L4←L5)을 역행하므로 허용되지 않는다.

**Why:** 이 프로젝트의 레이어 규칙(`docs/design-docs/layer-rules.md`)에서 상위 레이어(L4)가 하위 레이어(L2)를 import하는 것은 금지다. 해당 스키마의 3개 필드(`warn`, `critical`, `pause`)는 안정적인 계약 값이므로 duplication 비용이 layer 위반 비용보다 낮다고 판단.

**How to apply:**

- L4 config 타입이 L2/L3 스키마의 필드 일부를 참조해야 한다면, L2를 import하지 말고 해당 필드를 L4에서 인라인 재선언한다.
- 재선언 범위가 커지면(5개 필드 이상) 공유 타입을 L5 Types 레이어로 올리는 것을 검토한다.
- 재선언 시 주석으로 `// mirrors ThresholdConfigSchema in analyzer/thresholds.ts — no import to preserve layer direction` 명시 권장.
