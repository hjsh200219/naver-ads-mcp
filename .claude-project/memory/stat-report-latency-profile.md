---
name: stat-report-latency-profile
description: weekly 리포트 latency 실측 프로파일 — poll-sleep 89%, 병렬화가 유일 개선 경로
type: reference
created: 2026-05-29
---

weekly `prepare_weekly_payload` live path 실측 (hellomax, 2026-W20, payload 1118 bytes):

- 개선 전: stage1 30.5s. 분해 = poll-sleep 누적 ~27s (89%), 네트워크 3.2s (11%, 86 calls/28 POST, 평균 39ms).
- 원인: 14일 × 2 reportTp(AD, AD_CONVERSION) = 28 stat-report job을 순차 fetch (`server.ts` fetchByDay `for await`). 각 job poll sleep(initialDelay)이 직렬 누적.
- 개선 후: 6.5s (Fix 1 동시성 cap 8 + Fix 2 poll initialDelay 250).

**Why:** Naver API가 느린 게 아니라 우리 poll cadence + 순차 실행이 주범이었음. 추정 말고 실측이 fix 방향을 결정.
**How to apply:** latency 의심 시 추정 금지 — `/tmp/time-weekly.mjs`(hop별) + `/tmp/time-perday.mjs`(네트워크 vs sleep 분해) 재실행. n=1 한계: hellomax는 작은 광고주 → 큰 광고주는 build 느려 악화 가능.

관련: [[stat-report-poll-behavior]] [[naver-api-quirks]] [[concurrency-util-apply-scope]] [[weekly-dashboard-3tool-flow]]
