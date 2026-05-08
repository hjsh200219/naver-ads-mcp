---
name: omc-state-cleanup
description: Stop hook이 ralph/ralplan 재시작을 시도할 때 대응법
type: feedback
created: 2026-05-08
---

# 증상

작업 완료 후에도 Stop hook이 다음 메시지로 재시작을 시도:

- `[RALPH LOOP - ITERATION N/100] Work is NOT done. Continue working.`
- `[RALPLAN - CONSENSUS PLANNING | REINFORCEMENT N/30] ...`

# 원인

`.omc/state/sessions/{sessionId}/` 아래의 stale state 파일 (`ralph-state.json`, `ultrawork-state.json`, `skill-active-state.json`).

# 대응

ToolSearch로 state tools 로드한 뒤:

```
mcp__plugin_oh-my-claudecode_t__state_clear({mode: "ralph", session_id: "..."})
mcp__plugin_oh-my-claudecode_t__state_clear({mode: "ultrawork", session_id: "..."})
mcp__plugin_oh-my-claudecode_t__state_clear({mode: "skill-active", session_id: "..."})
```

ralph가 ultrawork와 linked되어 있을 수 있으므로 둘 다 clear. `skill-active`는 마지막에 항상 clear (Issue #2118 — stale skill-active-state.json이 hook 재발화).

# 대안

`/oh-my-claudecode:cancel` skill이 자동 처리. state tools가 deferred면 ToolSearch 먼저 필요.

**Why:** 작업 완료 후 hook이 사용자 입력처럼 보이는 system-reminder를 발사하면 의도치 않은 추가 작업 발생. 한번 정리하면 같은 세션 안에서는 깨끗하나 새 turn에서 재발 가능.

**How to apply:** Stop hook의 RALPH/RALPLAN/ULTRAWORK 패턴 메시지 발견 즉시 state clear. 사용자 새 명령이 우선.
