# PRD — 주간 리포트 생성 속도 개선 (Naver Ads MCP)

> Status: Fix 1+2+3 구현·검증 완료 (30.5s → 6.54s, 4.7×; tool 7→6) · architect APPROVED · 2026-05-29 · 성능 PRD (실측 기반)
> Trigger: 실사용자(AE) 보고 — "클로드코드와 비주얼스튜디오 둘다 30분 걸림. 멀 많이 물어보드라구요"
> 사용자 확정: **질문은 의도된 동작 — 유지.** 고칠 대상 = **리포트 만들 때마다 느림 (per-report 런타임 속도).**

---

## 0. 한 줄 요약

주간 리포트 생성의 server-side 시간 **실측 30.5초** 중 **89%(~27초)가 우리 코드의 poll-sleep 대기**, 네트워크는 11%(3.2초)뿐. 원인 = `fetchByDay`가 **14일 × 2종 = 28개 stat-report job을 순차로** 돌리며 각 job의 poll 백오프 sleep(기본 1초+)을 누적시킴. Naver API가 느린 게 아니다. **fix = 동시성 + poll cadence 단축** → 한 자릿수 초 목표.

---

## 1. 측정 결과 (baseline)

실측 harness: `/tmp/time-weekly.mjs`, `/tmp/time-perday.mjs` (실 자격증명 hellomax, week=2026-W20, payload 1118 bytes).

| 단계                                                       | 실측           | 비고                                                           |
| ---------------------------------------------------------- | -------------- | -------------------------------------------------------------- |
| **stage1 `prepare_weekly_payload`** (live 14일 fetch+집계) | **30.5–32.8s** | **dominator**                                                  |
| stage2 `generate_weekly_analysis_prompt` (순수, I/O 없음)  | **0.00s**      | 무시                                                           |
| host-LLM 분석 생성 (stage2↔stage3 사이)                    | 미측정         | user_prompt 1118B + schema 886B = ~2KB → 작은 출력, 수 초 추정 |

**stage1 네트워크 분해 (per-day 계측):**

```
TOTAL stage1: 30.50s | network calls: 86
sum of network wait: 3.22s (11% of stage1)   ← 네트워크
  GET: 58 calls, 39ms avg   POST: 28 calls, 33ms avg
slowest single call: 0.29s
→ 나머지 27.3s (89%) = pollUntilBuilt 의 sleep 대기
```

개별 네트워크 콜은 전부 빠름(평균 ~39ms, 최악 0.29s). 시간은 **콜 사이 sleep**에서 샌다.

---

## 2. 근본 원인 (코드 증거)

### 2.1 28개 job 순차 + job당 poll-sleep 누적 — **dominator**

- `src/mcp/server.ts:689–718` `fetchByDay`: `for (const statDt of enumerateDates(...))` — **14일을 순차 `await`**. 미래 일자 skip해 실효 ~13일.
- 종류는 2개(`AD`, `AD_CONVERSION`)만 `Promise.all` 병렬 (`server.ts:720`). **각 종류 내부 14일은 직렬.** → 총 ~28 job 직렬.
- `src/api/stat-reports.ts:111` `requestStatReport`: job 1개 = POST(생성) → `pollUntilBuilt` → download.
- `src/api/stat-reports.ts:76–108` `pollUntilBuilt`: 첫 GET은 sleep 전 즉시 실행(`:90`) — BUILT면 sleep 0. 아니면 `await sleep(delay)` 후 재폴, `delay`는 `initialDelayMs(1000) → 2000 → 4000 … → maxDelayMs(30000)` 지수 증가(`:106–107`).
- 실측 GET 58 / 28 job ≈ **job당 2 GET** = "첫 GET 미완 → 1초 sleep → 2nd GET BUILT" 패턴. **job당 ~1초 sleep × 28 직렬 ≈ 27초.** 네트워크 3.2s 합 = 30.5s. 산수 일치.

> 정정: "POST 직후 무조건 1초 sleep"은 **틀린 가설**이었다. 코드는 이미 첫 GET을 즉시 실행한다. 진짜 주범은 *순차 28 job이 각자 backoff sleep을 걷는 누적*이다.

### 2.2 poll cadence 과함 (보조)

- `initialDelayMs: 1000` (`stat-reports.ts:71`) — job이 0.2초에 BUILT돼도 다음 확인까지 1초 대기.
- backoff `1→2→4→8→16→30s`: 큰 광고주처럼 build가 5–10초 걸리는 job은 poll이 15초까지 overshoot 가능.

### 2.3 범위 호출로 job 수 축소 — **불가 (검토 후 기각)**

- `/stat-reports` POST body는 `{reportTp, statDt}` 단일 일자 전용 (`stat-reports.ts:122–125`, 타입 `:22`). Naver SearchAd StatReport는 일자별 생성이 공식 스펙 — 날짜 범위 미지원.
- → "28 job → 2 job" 레버는 이 엔드포인트로 **불가.** fix는 동시성으로.

### 2.4 3홉 = 3 LLM 턴 (보조, 속도엔 소폭)

- weekly = `prepare_weekly_payload` → `generate_weekly_analysis_prompt` → `finalize_weekly_dashboard`.
- server-side stage2 = 0초. 합쳐도 server 시간 이득 없음. **단 round-trip(사용자↔Claude 턴) 1회 절감** = 체감 속도 소폭 개선. C2(아래) 때문에 2홉이 floor.

---

## 3. 설계 제약 (fix가 지켜야)

- **C1 (HARD)**: MCP 서버는 Anthropic SDK 비의존 — 분석은 host LLM이 수행. 되돌리지 않음.
- **C2 (floor)**: dashboard 경로는 host-LLM-중간-분석 때문에 **최소 2콜** (KPI+prompt 반환 → host 분석 → finalize). 1콜화 = C1 위반. 3홉은 2홉까지 줄일 수 있음(tool1+tool2 통합), 그 아래 불가.
- **C3**: 동시성 올려도 Naver rate limit(429) 준수 — 기존 client retry(`429 Retry-After`, 5xx backoff)가 처리하나 동시성 cap으로 폭주 방지.

---

## 4. 목표

| 지표                                  | baseline(실측) | 목표         |
| ------------------------------------- | -------------- | ------------ |
| stage1 server-side 시간 (작은 광고주) | 30.5s          | **< 8s**     |
| dashboard 콜 홉 수                    | 3              | 2 (C2 floor) |

> **n=1 경고**: 측정한 hellomax payload = 1118 bytes = 작은 광고주. 큰 광고주는 Naver build가 느려 job당 poll 사이클↑ → **30초보다 악화** 가능. 동시성·backoff-cap의 당위를 강화하는 방향. (재측정은 큰 광고주 자격증명 확보 시 1회면 충분.)

---

## 5. 해결 방향 (실측 기반 우선순위)

### Fix 1 — 14일 fetch 동시성 (최대 레버) ✅ 구현·검증 완료

- ~~`fetchByDay`의 순차 `for await` 루프~~ → flat-28 task pool + 동시성 cap. 의존성 추가 없이 인라인 `mapWithConcurrency` helper.
- **실측 결과: stage1 30.5s → 8.70s (3.5× 단축). payload 동일(1118 bytes) = 회귀 없음.**
- 구현:
  - `src/util/concurrency.ts` (신규) — `mapWithConcurrency<T,R>(items, limit, fn)` 입력순서 보존 + first-rejection. `CONCURRENT_STAT_JOBS = 8`.
  - `src/mcp/server.ts:692` — 14일×2종을 flat-28 task list로 (future 일자 선필터), `mapWithConcurrency`로 fetch, reportTp 파티션. 4xx/FAILED → `[]`, 5xx → rethrow.
- 테스트: `tests/concurrency.test.ts`(5), `tests/weekly-fetch-concurrency.test.ts`(2 — max-in-flight ≤ 8, 28 job, 5xx 전파). 전체 361 passing.

### Fix 2 — poll cadence 단축 (보조)

- `DEFAULT_POLL.initialDelayMs 1000 → 200~300` (`stat-reports.ts:71`). 작은 job이 1초 안에 BUILT면 첫 대기 대폭 감소.
- backoff cap은 유지하되 초기 구간을 촘촘히. Fix 1과 곱으로 작동.

### Fix 3 — 3홉 → 2홉 (round-trip 절감, 별도)

- tool1(payload)+tool2(prompt) 통합 — 단일 진입 tool이 payload+prompt 한 번에 반환 → host 분석 → finalize. C2 준수.
- server 시간 이득 0, LLM 턴 1회 절감(체감). Fix 1/2 이후 선택적.

### 검증 루프

- 동일 harness `/tmp/time-weekly.mjs` 재실행 → 30.5s → 목표 입증. TDD: fetchByDay 동시성 테스트(mock 28 job, cap 준수 + 시간 단축) 먼저.

---

## 6. 비목표 (사용자 의도·실측 반영)

- ❌ **명확화 질문 제거** — 사용자: "질문은 의도된 동작". B1(형식선택)/B2(인자누락) 마찰은 이 PRD 대상 아님.
- ❌ **1회성 setup 마찰** — 사용자: "리포트 만들 때마다"(per-report). API 발급/accounts.json/MCP 등록/재시작은 1회성 → 이 PRD 대상 아님. (별도 백로그.)
- ❌ MCP가 Anthropic SDK 직접 호출 (C1).
- ❌ dashboard 1콜화 (C2).
- ❌ /stat-reports 범위 호출 (§2.3, API 미지원).

## 7. 열린 질문

1. 동시성 cap 값 — Naver rate limit 실측 필요 (4? 6? 8?). 보수적 4로 시작 권장.
2. Fix 3(2홉 통합) 이번 범위 포함 여부 — 속도 이득 작아 후순위 가능.
3. 큰 광고주 baseline 재측정 우선순위.

## 8. 증거 출처

- 실측: `/tmp/time-weekly.mjs`(30.5s, stage2=0s), `/tmp/time-perday.mjs`(network 11%, poll-sleep 89%, 86 calls/28 POST)
- 코드: `src/mcp/server.ts:689–723`(순차 fetchByDay), `src/api/stat-reports.ts:76–139`(poll loop + statDt 단일)
- 제약: AGENTS.md(Anthropic 비의존), `weekly-report-automation-plan.md:46`(원래 단일 tool 설계)
