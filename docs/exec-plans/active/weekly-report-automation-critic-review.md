# Critic Review — helloMAX Weekly Report Automation (Planner Draft v0.2)

> 리뷰어: Critic (consensus workflow)
> 날짜: 2026-05-08
> 대상: `weekly-report-automation-draft.md` v0.2 (Architect ITERATE 반영본)
> 판정: **ITERATE** (v0.2는 Architect 차단 4건을 모두 흡수했으나, 운영 게이트 5건이 비어 있어 Phase 0 진입 전 보강 필수)

---

## 0. 리뷰 범위 안내

Architect 리뷰가 §4.1~4.4 차단 + §4.5~4.7 경고를 이미 처리했다는 전제로 같은 항목은 재반박하지 않는다. 본 Critic 리뷰는 v0.2가 **추가로 약속한 사항이 실제로 testable·verifiable·operable**한지, 그리고 **운영(observability, cost, rollback, training, concurrency, test data, scope)** 차원에서 빠진 부분만 다룬다.

---

## 1. Principle ↔ Option A 정합성

| Principle                            | Option A 설계 일치도 | 비고                                                                                                                                                                                                                      |
| ------------------------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. MCP-first                         | ◎                    | tool 2 + resource 2 추가, surface 비대화 방지 명시. layer-rules 갱신을 Phase 0 산출물로 박은 것은 일관됨.                                                                                                                 |
| 2. HITL, 자연어 편집 default         | ○                    | 자연어 default 명시는 좋으나 "MCP 재호출"이 곧 새 Anthropic 호출 = **재호출 비용/지연**이 §Risk·§Cost 어디에도 잡혀 있지 않음 (아래 6.2 참조).                                                                            |
| 3. Stateless artifact, evidenced run | △                    | "stateless"라면서 `payload_hash` LRU 캐시 5분을 도입 → **send 시점에 캐시 만료된 hash 거절** edge case가 acceptance·verification에 없음.                                                                                  |
| 4. Data 신뢰가 1순위                 | ○                    | 사전 계산 + 2단계 guard는 일관. 단 "사전 계산 인용 강제"의 측정 정의가 Open Q1에서 본인이 인정한 대로 미정.                                                                                                               |
| 5. Phased delivery, security-baked   | ○                    | Phase 4 runbook + grep 회귀가 적절. 단 SECURITY.md 본문(현재 머신 분실 절차 없음)과의 cross-link 의무가 §AC #11에는 있으나 **Phase 4 산출물 체크박스에는 "SECURITY.md 보강"만 있고 "본 plan과의 양방향 링크" 명시 없음**. |

**핵심 모순**: Principle 3의 stateless 주장과 §Architecture의 `payload_hash` LRU 5분(메모리 상태) + history JSONL(디스크 상태)은 엄밀히 stateful이다. 주장은 "**evidenced** run"으로 좁히고, "stateless artifact"는 artifact 자체에 한정하는 표현으로 다듬으면 충돌이 사라진다. 표현 문제이지만 ADR 작성 전 정정 권장.

---

## 2. B / C 무효화 공정성

- **Option B (풀스택 SaaS)** — "14주 vs 8주, 6 광고주 규모에서 인프라 과함" 무효화는 합리적. 단 "12+ 광고주 시 §Migration Path" 트리거 2개 충족 조건은 **시간 트리거 없음** = "AE 만족도가 4/5 미만 + 6 광고주에서 hallucination 사고 1건 발생" 같은 **품질 트리거**도 추가해야 강요된 마이그레이션이 늦지 않는다.
- **Option C (Hybrid MCP + 경량 Web)** — "1팀 capacity로 두 코드베이스 불가" 만으로 단정. 그러나 **artifact 페이로드 budget 초과 fallback**이 "MCP resource로 분리"로 적혀 있는데, 이건 사실상 Hybrid의 thin slice다. 즉 Option A가 fallback 경로에서 C를 부분 흡수한다는 것을 명시하면 무효화가 더 정직해진다.

**판정**: B/C 무효화 자체는 strawman은 아니지만, B 트리거에 품질 축이 빠진 것은 보강 필요.

---

## 3. Risk Mitigation 구체성 평가

| Risk                      | Mitigation 구체성 | 문제                                                                                                                             |
| ------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| AI 환각                   | ○                 | "사전 계산 필드 ⊂ 매칭" 자동화 가능. 단 §Open Q1대로 임계값(0%/95%) 미정 = 게이트 만들 수 없음.                                  |
| 엑셀 변형                 | ○                 | data_warnings[] 명시 좋음. 그러나 "AI 보조" 단계가 Anthropic 호출인지 룰 기반인지 미정.                                          |
| MCP 단일 장애점           | ◎                 | stdio 모델로 자연 해소.                                                                                                          |
| Claude rate limit/cost    | △                 | "prompt caching, haiku 라우팅" — **수치 없는 손짓**. 광고주 6 × 주 1 × 4주 × 평균 토큰 추정치가 §Cost 절에 없음 (아래 6.2).      |
| AE 머신 분실              | ◎                 | runbook + 백업 주 1회 명시. 단 "외부 안전 저장소"가 어디인지 미정 (workspace/.env에 저장된 클라우드? 1Password? 별도 정책 필요). |
| Live artifact 데이터 유출 | ○                 | 외부 fetch 0 명시. clipboard 복사는 OS 클립보드 → 다른 앱 접근 가능 risk 미언급.                                                 |
| 0.7 confidence FP         | △                 | "Phase 4 tuning"만 — **무엇으로 측정해서 어떻게 조정**하는지 절차 없음.                                                          |
| Email 발송 실패           | ○                 | bounce 구독 + 5분 status 재확인. 그러나 "재확인 실패 시 누가 어떻게 통지받는지"가 빠짐 = observability 공백 (아래 6.1).          |
| Artifact 페이로드 budget  | ◎                 | Phase 0 PoC + resource fallback.                                                                                                 |
| Tool surface 비대         | ◎                 | resource 4 + tool 5 비율 명시.                                                                                                   |
| Anthropic 키 오염         | ◎                 | enumerable:false 패턴 일관.                                                                                                      |

**가장 약한 mitigation 3개**: rate limit/cost (수치 없음), 0.7 FP (튜닝 절차 없음), bounce 알림 경로 (누가 받나).

---

## 4. Acceptance Criteria 11개 testability 평가

| #   | 기준                                    | 판정                    | 사유                                                                                                                          |
| --- | --------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | 245+ tests passing                      | testable                | CI 게이트 가능. **단 "Phase 1 12+, 2 18+ ..."가 합쳐서 50+이지 245+ 도달의 절대값 보장은 209+50=259. 수치 일관성 점검 필요.** |
| 2   | 6 광고주 파싱 100%                      | testable                | 고정 픽스처 가정. **테스트 데이터 = 실 광고주 엑셀이면 CI에 못 올림** (아래 6.6).                                             |
| 3   | artifact 정상 렌더 + 자연어/inline 편집 | **부분 aspirational**   | "정상 렌더"의 객관 정의 없음 (DOM 노드 수? 페이지 길이? 콘솔 에러 0?). 수동 검증으로만 적힘 → 회귀 불가.                      |
| 4   | review_text 숫자 ⊂ payload 사전계산     | **미정**                | Open Q1로 본인이 인정. 임계값 없으면 게이트 불가.                                                                             |
| 5   | 1명 테스트 발송 + history append        | testable                | OK.                                                                                                                           |
| 6   | AE 만족도 평균 4/5                      | testable but **biased** | 표본 2~3명 → 분산 큼. 어떤 설문 항목·언제·익명 여부 미정.                                                                     |
| 7   | confidence < 0.7 시 경고                | testable (수동)         | 자동 시각 회귀 가능 (snapshot). 명시 없음.                                                                                    |
| 8   | grep 회귀 0건                           | testable                | ◎                                                                                                                             |
| 9   | email 채널 + 도메인 인증 status         | testable                | dig/dkim 검증 명령 명시 권장.                                                                                                 |
| 10  | layer-rules + ESLint zone pass          | testable                | ◎ (`npm run lint` 0 violations).                                                                                              |
| 11  | Phase 4 runbook merge + cross-link      | testable                | OK.                                                                                                                           |

**aspirational/ambiguous = #3, #4, #6**. 셋 모두 ship 게이트로 쓸 수 없는 상태로 v0.2에 박혀 있다 — Phase 0 진입 전 측정 정의 보강 필수.

---

## 5. Verification Steps 10개 재현성 평가

신입 엔지니어 1명이 plan만 보고 재현 가능한지:

| #                               | 재현성 | 갭                                                                                             |
| ------------------------------- | ------ | ---------------------------------------------------------------------------------------------- |
| 1 `npm test`                    | ◎      | —                                                                                              |
| 2 `npm run typecheck`           | ◎      | —                                                                                              |
| 3 `npm run lint` (zone)         | ○      | "ESLint 설정 어디서 시작?" — Phase 0에서 zone update 산출물 PR 머지 후만 가능. 순서 명시 필요. |
| 4 build → stdio 부팅 ≤ 2s       | ○      | 측정 도구 미정 (`time node dist/index.js`?).                                                   |
| 5 prepare_weekly_dashboard 호출 | △      | **자격증명 없는 신입은 호출 불가**. fixture/dry-run 모드 필요 (아래 6.6).                      |
| 6 자연어 편집 재호출            | △      | 동일.                                                                                          |
| 7 send_report_email 발송        | △      | 동일 + SES sandbox/실주소 정책 미정.                                                           |
| 8 history JSONL 확인            | ◎      | path/형식 명시.                                                                                |
| 9 hallucination guard           | △      | "CI script" 위치/이름 미정.                                                                    |
| 10 grep 회귀                    | ◎      | 명령 그대로 복붙 가능.                                                                         |

**핵심 결손**: 5/6/7은 **실 광고주 자격증명 없이 어떻게 검증**할지 없음. dry-run/mock 모드를 verification step 0으로 추가해야 한다.

---

## 6. Coverage Gaps (Phase 0 진입 차단)

### 6.1 Observability/Logging — **차단**

RELIABILITY.md는 retry/timeout 정책을 명시하지만, 본 plan은 **운영 중 어떻게 알지**를 답하지 않는다:

- AE가 발송 실패했는데 5분 status 재확인도 실패한 경우 → 알림 채널 없음.
- prepare_weekly_dashboard에서 Anthropic 호출 실패 → AE 화면에 어떻게 표시? Claude Desktop 에러 메시지로 끝?
- history JSONL append 실패 → silent? throw?
- Phase 3 Slack webhook이 "옵션"이 아니라 **운영 알림 채널 default**여야 한다 (광고주 미수신은 6 광고주 규모에서도 비즈니스 사고).
- 구조화 로그 포맷(JSON line, level, request_id) 표준 미정 → grep 회귀(AC #8)도 한정적.

**요구**: §Observability 절 신설. (a) 로그 레벨/포맷, (b) 발송 성공/실패 알림 채널, (c) Anthropic API 에러 표면화 경로.

### 6.2 Cost Ceiling — **차단**

Anthropic 비용 계산이 0줄. 추산 모델 부재:

- 광고주 6 × 주 1 × 4주 = **월 24 호출** 최소.
- AE 자연어 편집 default → 평균 재호출 N회 가정 (1.5? 2?) → 월 36~48.
- Sonnet 4.6 input 평균 (system + few-shot 캐시 후) + output 추정 → 월/광고주 USD 추정치.
- 데일리(Phase 3)는 **6 광고주 × 5 영업일 × 4주 = 월 120 호출** 추가 → 본 plan에서 데일리 비용은 _언급조차 없음_.
- prompt caching이 실제로 cache hit 90% 도달하는지 측정 게이트 없음.

**요구**: Phase 0 산출물에 (a) 토큰/호출 실측, (b) 월 비용 ceiling 수치, (c) ceiling 초과 시 자동 알림(예: AE 호출당 평균 비용 × 2배 시 Slack). 수치 없으면 ZBROS/helloMAX 결재 근거가 없다.

### 6.3 Rollback Plan — **차단**

각 Phase 산출물이 머지된 뒤 운영 중 결함이 발견되면 어떻게 되돌릴지 답이 없다:

- Phase 2 머지 후 hallucination 사고 발생 → MCP tool 끄는 feature flag? 광고주별 disable list?
- Phase 3 머지 후 SES 도메인 신뢰도 손상 → EML fallback으로 즉시 전환하는 toggle?
- Phase 4 runbook 머지 후 키 회전 실수 → 이전 키로 롤백?

**요구**: §Rollback 절 신설. Phase별 1줄 rollback 절차. 최소 (a) tool disable mechanism (env flag), (b) email channel toggle, (c) 광고주별 자동화 opt-out.

### 6.4 AE Training Plan — **차단**

§Phase 4에 "운영 매뉴얼 작성 (README.md 추가 섹션)"만 있고:

- AE 2~3명 교육 시간/슬롯 미배정.
- "자연어 편집 default" 학습 곡선 가정 없음 (예: AE가 "톤 부드럽게"의 의미가 LLM마다 다를 수 있음 → 예시 프롬프트 chest sheet 필요).
- 매뉴얼 검증(AE가 매뉴얼만 보고 1주 리포트를 발송할 수 있는가)이 acceptance 아님.
- v2 onboarding(Phase 5)에서 새 AE 입사 시 reonboarding 절차 미정.

**요구**: Phase 4에 (a) 교육 워크숍 1회(2시간), (b) 자연어 편집 예시 cheat sheet 5개, (c) AE 1명이 매뉴얼만으로 1광고주 발송 성공이라는 acceptance 추가.

### 6.5 Concurrency / Race Conditions — **차단**

`payload_hash` idempotency 주장의 안전성 미검증:

- AE 2명이 같은 client·같은 week를 동시에 prepare_weekly_dashboard 호출 → 서로 다른 payload_hash 2개 발급. 한 명이 발송 → 다른 한 명이 같은 hash로 발송 시도하면 거절되지만, **다른 hash로 두 번째 발송**은 그대로 통과 = **광고주 이중 수신 사고**.
- history JSONL append는 비원자적 (`fs.appendFile`은 concurrent write 시 line interleave 가능).
- LRU 캐시 5분 만료 후 재호출 시 같은 payload면 같은 hash가 재발급되는가 (deterministic hash) 또는 새 hash인가 — 명시 없음.
- 5분 캐시 만료 후 AE가 "발송해" → tool이 hash 만료로 거절 → AE가 "다시 검토" → 새 hash → 발송 흐름 중간에 실수로 stale hash로 발송 시도하는 시나리오 처리 미정.

**요구**: §Concurrency 절 신설. (a) `(client, week)` 단위 advisory lock(파일락 또는 메모리 mutex), (b) history append를 `fs.appendFile` 대신 atomic write(temp + rename) 또는 write-through queue, (c) hash 결정성 정의, (d) 만료 hash UX 정의.

### 6.6 Test Data Strategy — **차단**

- 6 광고주 엑셀이 `docs/references/`에 있고 `.gitignore` + `.claudeignore` 등록(SECURITY.md §로컬 데이터 보호)됨 → **CI에 픽스처로 못 올림**.
- vitest 6/6 광고주 파싱 100% (AC #2)는 누가 어디서 돌리는가? 로컬만? 그러면 CI 게이트 의미 없음.
- 익명화된 fixture 6개를 별도 디렉토리에 두고(광고주 식별자만 가린 형태) CI에서 사용하는 정책 필요.
- 통합 테스트(MCP integration) 시 Naver API/Anthropic API 둘 다 mock인지 live인지 구분 명시 없음. QUALITY.md는 "외부 API 호출은 반드시 mock"으로 강제 → 본 plan과의 일관성 점검 필요.
- email 발송 검증(AC #5)은 어디로? 광고주 실주소? 내부 dummy? Phase 3 verification step 7에 "Gmail/SES 수신 확인"이 있는데 **누구의 inbox** 미정.

**요구**: Phase 0에 (a) 익명 fixture 6개 추출 절차 + 저장 위치, (b) Naver/Anthropic mock 정책, (c) 발송 테스트용 helloMAX 내부 inbox 1개 지정.

### 6.7 Out-of-Scope 경계 — **경고**

- "Phase 5 신규 광고주 온보딩은 v2"는 명시. 그러나 **데일리 자동화 범위**가 Phase 3에 끼어 있는데, 데일리는 §자동화 우선순위 매핑 표에서 워크플로우 1-1-① ~ ④ 4건. 이 4건의 acceptance가 plan에 0개 — **데일리도 acceptance/verification 받아야** 한다.
- "데일리 호출 응답 ≤ 60초" 1줄로 데일리가 ship 가능하다고 보기 어렵다. 데일리 임계값 정의(어떤 KPI가 임계값 초과 시 알림인지), Slack 워크스페이스(Open Q3과 연결) 미정.
- 데일리를 Phase 3 안에 끼우는 대신 **데일리 acceptance 3~4개 신설** 또는 **데일리를 Phase 3.5로 분리**.

**요구**: 데일리 acceptance 3개 추가, 또는 phase 분리.

---

## 7. Open Questions 3개 — 차단성 평가

1. **Q1 (review_text 숫자 매칭 게이트 0% vs 95%)** → **차단**. AC #4 / Verification #9 / Risk mitigation 1번이 모두 이 임계값에 의존. plan 승인 전 결정 필수. 권장: 1차 ship은 95% (정규식 false positive 흡수), Phase 4 tuning에서 99%로 조이는 단계 게이트.
2. **Q2 (runbook 검증자)** → **deferable**. Phase 4 진입 전까지 결정하면 됨. 단 "외부 보안 1인"이 ZBROS 내부인지 외부인지는 비용 결재라 1주 안에 결정 필요.
3. **Q3 (Slack webhook 워크스페이스)** → **차단** if 6.1 (observability)을 받아들이면 Slack이 default 알림 채널 → workspace 미정 = 알림 default 미정 = Phase 0 진입 불가.

**즉 v0.2 Open Q 3건 중 2건(Q1, Q3)은 plan 승인 전 결정 필수.** Q2만 deferable.

---

## 8. Verdict

**ITERATE** — Architect ITERATE 차단 4건은 v0.2가 잘 흡수했다. 그러나 **운영 게이트 5건**(observability·cost·rollback·training·concurrency·test data)이 비어 있어 Phase 0에 들어가도 곧 막힌다. 광고주 신뢰가 핵심 자산인 helloMAX 맥락에서, 이 중 어느 한 건이라도 사고가 발생하면 파일럿 자체가 흔들린다. 큰 그림(Option A, 8.5주, MCP 확장)은 유효하므로 **ADR 채우기 직전 1라운드 더**.

### MUST-FIX (Phase 0 진입 전 plan에 반영해야 할 7개)

1. **Observability 절 신설** — 로그 포맷 표준, 발송 성공/실패 알림 채널 default(Slack workspace 결정 포함), Anthropic 에러 AE 표면화 경로.
2. **Cost ceiling 수치화** — 주간/데일리 합산 월 호출수·비용 추정 + ceiling 초과 알림 트리거. Phase 0 PoC 산출물에 추가.
3. **Rollback 절 신설** — Phase별 1줄 rollback (tool disable env flag, email channel toggle, 광고주별 opt-out).
4. **Concurrency 안전성** — `(client, week)` 단위 lock, history JSONL atomic append, payload_hash 결정성·만료 UX 정의. AC와 verification에 race 테스트 1개 명시.
5. **Test data + CI 정책** — 익명 fixture 6개 추출 절차, Naver/Anthropic mock 강제, 발송 테스트 inbox 지정.
6. **Acceptance #3·#4·#6 측정 정의** — #3 "정상 렌더"의 객관 기준(DOM·콘솔·snapshot), #4 임계값(Open Q1 결정), #6 설문 항목·표본·익명성.
7. **Open Q1 + Q3 결정** — 1차 ship 임계값(권장 95%), Slack workspace(observability default 채널).

### SHOULD-FIX

8. AE 교육 워크숍 + cheat sheet + "AE 1명 매뉴얼만으로 1광고주 발송" acceptance.
9. 데일리(Phase 3) acceptance 3개 신설 또는 Phase 3.5로 분리.
10. Option B Migration 트리거에 **품질 축**(AE 만족도, hallucination 사고 카운트) 추가.
11. Principle 3 표현 정정 ("stateless artifact" vs hash LRU/JSONL stateful 충돌 해소).

위 7+4를 반영한 v0.3 → ADR 채우고 Phase 0 진입.

---

## 9. 참고 — 본 리뷰가 _반박하지 않은_ 항목

다음은 v0.2가 이미 잘 처리했다고 보아 재반박하지 않음:

- Architect §4.1 artifact ↔ MCP 통신 PoC (Phase 0 추가됨).
- Architect §4.2 tool 추가 사유 + resource 분리 (5 tools / 4 resources 명시).
- Architect §4.3 layer-rules 라벨 (표 + ESLint zone Phase 0 산출물).
- Architect §4.4 hallucination guard 사전계산 인용 강제 (시스템 프롬프트 + 출력 검증).
- Architect §4.5 Anthropic 키 .env + enumerable:false.
- Architect §4.7 email 채널 (SES default + EML fallback).
- Architect §4.6 Phase 4 → 2주, 8.5주 총합.

이 7개는 v0.2의 정당한 진전이며, 본 Critic의 ITERATE는 "Architect 항목 미반영"이 아니라 **운영 차원의 신규 갭**에 의한 것이다.
