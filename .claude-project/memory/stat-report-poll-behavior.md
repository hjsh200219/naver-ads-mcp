---
name: stat-report-poll-behavior
description: requestStatReport poll 루프 실동작 — 첫 GET은 sleep 없이 즉시, sleep은 non-BUILT일 때만
type: reference
created: 2026-05-29
---

`pollUntilBuilt` (`src/api/stat-reports.ts`):

- while 첫 바퀴 GET은 sleep 전 즉시 실행. status=BUILT면 sleep 0회.
- sleep은 status가 REGIST/RUNNING(non-BUILT)일 때만 발생 → 지수 백오프 `delay = min(delay*2, maxDelayMs)`.
- DEFAULT_POLL: initialDelayMs 250 (1000에서 단축), maxDelayMs 30000, totalTimeoutMs 600000.

**Why:** "POST 직후 강제 1초 sleep 있다"는 틀린 가정이었음. latency는 upfront sleep이 아니라 순차 28 job이 각자 1차 sleep을 걷는 누적. 이 오독을 따랐으면 "즉시 poll하게 고쳐라" = no-op이 됐을 것.
**How to apply:** poll latency 줄이려면 (a) initialDelay 단축 — 작은 job이 1초 내 BUILT면 효과 / (b) 순차 → 병렬. backoff cap은 큰 job용으로 유지. stat-reports 테스트는 모두 poll 인자 명시 주입이라 DEFAULT 변경 시 회귀 0.

관련: [[stat-report-latency-profile]] [[stat-reports-signed-download]]
