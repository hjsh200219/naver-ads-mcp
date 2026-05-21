---
name: tool-description-llm-guidance-limits
description: MCP tool description으로 LLM 행동 유도는 약함. "BEFORE CALLING" 류 강제 안내도 호출 측 LLM이 무시 가능
type: feedback
created: 2026-05-21
---

MCP tool description은 LLM client(Claude Desktop 등)의 행동을 권고할 수 있으나 **강제력 약함**. 모호한 사용자 요청에서 형식 선택 안내를 description에 넣어도 LLM이 자기 판단으로 즉시 호출하는 경우 발견.

**증거** (commit 81032b5 → 20cf021):

- commit 81032b5: `generate_report` description에만 "리포트 모호 요청 시 사용자에 형식 묻기" 안내 추가
- 사용자가 "이번주 hellomax 리포트" 호출 → Desktop이 묻지 않고 `prepare_weekly_payload` 직접 호출
- commit 20cf021: 양쪽 entry tool (`generate_report` + `prepare_weekly_payload`) description 첫머리에 "STOP — BEFORE CALLING: 형식 선택 안 했으면 ASK first and WAIT" 강제 추가

**Why:** 호스트 LLM이 description의 "MUST ASK" 같은 강제 표현을 prompt instruction의 일부로만 취급. 명백히 모호한 입력에도 자기 추론으로 가장 그럴듯한 tool 호출.

**How to apply:**

1. 다중 entry path tool은 **양쪽** description에 안내 (한쪽만 넣으면 다른 path가 default됨)
2. description 첫머리에 "STOP — BEFORE CALLING" 식 강조
3. 모호 트리거 단어 명시 ("리포트", "주간 리포트", "report" 등)
4. 그래도 무시되면 → **dispatcher tool** 도입 (단일 entry → 사용자 응답 받은 후 적절한 sub-tool 분기). 이게 진짜 강제

관련: [[weekly-dashboard-3tool-flow]], [[mcp-resources-vs-tools]].
