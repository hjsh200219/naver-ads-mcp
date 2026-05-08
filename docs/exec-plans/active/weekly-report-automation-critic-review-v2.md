# Critic Review v2 — helloMAX Weekly Report Automation (Planner Draft v0.3)

> 리뷰어: Critic (consensus workflow, 2nd pass)
> 날짜: 2026-05-08
> 대상: `weekly-report-automation-draft.md` v0.3
> 직전 판정: ITERATE (MUST-FIX 7 + SHOULD-FIX 4)
> 본 판정: **ITERATE** — MUST-FIX 7건 중 6건 ADDRESSED + 1건 PARTIAL(Cost ceiling 수치 미정), SHOULD-FIX 4건 모두 ADDRESSED. 그러나 v0.3가 새로 만든 모순 2개(승인 게이트 / 일정 / 리졸브 표) + 누락 1개(Phase 0 자체 acceptance) 보강 후 APPROVE 가능.

---

## 0. MUST-FIX 7건 검수

| #   | 항목                          | 판정         | v0.3 위치                                                                                                     | 코멘트                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ----------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Observability 절 신설         | ✅ ADDRESSED | §Observability (L242–268). 로그 포맷 표준 + 알림 채널 매트릭스 6종 + AE 화면 표면화 3건                       | 명확. `#hellomax-mcp-sends`(성공)와 `#hellomax-mcp-alerts`(실패) 채널 분리 합리적. 단 "Cost ceiling 초과"가 일 1회 cron인데 cron 등록 위치(host? Claude Desktop?)는 v2 보강 권장(차단 아님).                                                                                                                                                                                                                                                 |
| 2   | Cost ceiling 수치화           | ⚠️ PARTIAL   | §Cost Ceiling (L272–286). 호출 수 추정(주간 36 + 데일리 120 = 월 156)만 확정, **USD ceiling은 "TBD Phase 0"** | **차단**. ZBROS가 결재 라인 USD 없이 Phase 1 GO를 줄 수 없다. "Phase 0 PoC 측정 후 결정"은 정당하지만, 그렇다면 **Phase 0 완료 게이트에 "ZBROS 결재 라인 USD 결정 + 서면 승인"이 명시 acceptance여야** 한다. 현재 Phase 0 완료 기준에는 "PoC 3개 결과 문서"만 있고 결재 절차가 빠짐.                                                                                                                                                         |
| 3   | Rollback 절 신설              | ✅ ADDRESSED | §Rollback (L290–305). Phase별 1줄 + 광고주별 opt-out flag (`automation_enabled: false`)                       | 양호. env flag 3종(`MCP_DISABLE_PREPARE`, `MCP_EMAIL_CHANNEL`, `MCP_DISABLE_DAILY`)은 코드에서 실제 구현 게이트가 필요한데 어느 phase에 박혔는지는 명시 안 됨 — Phase 2/3/3.5 산출물에 env flag 코드 추가가 묵시적이지만 acceptance에는 없음. SHOULD-FIX.                                                                                                                                                                                    |
| 4   | Concurrency 안전성            | ✅ ADDRESSED | §Concurrency (L309–315), Phase 3 race 테스트(L201)                                                            | 양호. `(client, week)` lock + atomic append + 만료 hash UX + `force-resend` flag 모두 명시. **다만 §Phase 4 hallucination tuning 95→99% 게이트와의 충돌 점검 필요** — tuning 중 같은 (client, week)에 대해 의도적 재발송 시 `force-resend=true`가 강제되는데, 이는 운영 마찰을 의미. 이중 발송 방지가 강한 정책이므로 합리적이지만, runbook §AE Training에 force-resend 절차 1줄 추가 필요(현재는 cheat sheet 5개에 포함 안 됨). SHOULD-FIX. |
| 5   | Test data + CI 정책           | ✅ ADDRESSED | §Test Data + CI (L319–326), Phase 0 fixture/mock 항목(L159–161)                                               | 양호. 익명 fixture 6개 + Naver+Anthropic 둘 다 mock + qa+ inbox 지정. E2E gate(`NAVER_ADS_E2E=1`)도 명시.                                                                                                                                                                                                                                                                                                                                    |
| 6   | Acceptance #3·#4·#6 측정 정의 | ✅ ADDRESSED | AC 표(L362–380) + Phase 2 (L188)                                                                              | #3은 DOM ≥ 100 + 콘솔 0 + 6 KPI 카드 등 객관 기준 명시. #4는 95%/99% 단계 게이트. #6은 표본 ≥ 2명, 익명, 8 항목 명시. 모두 testable.                                                                                                                                                                                                                                                                                                         |
| 7   | Open Q1 + Q3 결정             | ✅ ADDRESSED | Phase 0 결정(L152–153), Resolved Questions 표(L444–456)                                                       | Q1 95%/99%, Q3 ZBROS `#hellomax-mcp-alerts` 모두 결정.                                                                                                                                                                                                                                                                                                                                                                                       |

**MUST-FIX 결과**: 6 ✅ + 1 ⚠️ (Cost ceiling USD 미정 → Phase 0 게이트에 결재 acceptance 추가 필요).

---

## 1. SHOULD-FIX 4건 검수

| #   | 항목                                                  | 판정         | v0.3 위치                                                                                        |
| --- | ----------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------ |
| 8   | AE 교육 워크숍 + cheat sheet + 매뉴얼 검증 acceptance | ✅ ADDRESSED | §AE Training (L330–337), Phase 4 (L221–222), AC #13 (L378)                                       |
| 9   | 데일리 acceptance 3개 또는 Phase 3.5 분리             | ✅ ADDRESSED | Phase 3.5 신설 (L205–216), 데일리 acceptance (a)(b)(c) 명시, AC #12                              |
| 10  | B Migration 트리거 품질 축 추가                       | ✅ ADDRESSED | §Migration Path 품질 트리거 3종 (L417–420)                                                       |
| 11  | Principle 3 표현 정정                                 | ✅ ADDRESSED | Principle 3 (L17): "**stateless artifact**는 artifact 자체에 한정", "두 상태는 명시 audit trail" |

SHOULD-FIX 4건 모두 ✅.

---

## 2. NEW Issues — v0.3가 만든 신규 문제

### 2.1 일정 산수 불일치 — **차단**

L238: "총 8.5주 (Phase 0:1 + 1:1.5 + 2:2.5 + 3:1 + 3.5:1 + 4:2 = **9주**, 일부 병렬 시 8.5주)"

**문제**: 9주를 8.5주로 줄이는 "일부 병렬"이 어디서 어떻게 일어나는지 plan에 0줄. 가능한 후보:

- Phase 0 PoC 3개 병렬: 가장 가능성 높음, 그래도 Phase 0이 1주에서 0.5주로 줄지는 의문
- Phase 3 + Phase 3.5 병렬: 데일리는 분석기/runtime 재사용이라 부분 병렬 가능하지만, runtime/email-send + runtime/lock + runtime/history.atomic까지 쓰면서 동시에 데일리 임계값 정의·테스트는 1팀 capacity로 어렵다
- Phase 4 AE 파일럿이 Phase 3.5 데일리와 병렬: 데일리가 Phase 3.5에서 Phase 4 AE 파일럿 시작과 겹치면 가능

병렬 가정이 plan에 명시되어 있어야 일정 리스크를 평가할 수 있다. 현재는 0.5주 마법(magic shrinkage)으로 보인다. **Phase 표 옆에 "병렬 가능 표시(│)"** 또는 **타임라인 갠트 1줄** 추가 권장. 보강 안 하면 Phase 1 GO 시 일정 신뢰도 미정.

### 2.2 Resolved Questions 표의 "Phase 0 PoC" 위장 해소 — **경고**

L444 표에서 Q2(artifact 페이로드 한계), Q3(email 채널), Q4(confidence threshold), Q9(데일리 임계값 정의)는 **"Phase 0 PoC 측정"** 또는 **"Phase 4 tuning"** 으로 답한다. 이는 **해소(decision)**가 아니라 **결정 시점 commit**이다. 표의 "v0.3 결정" 컬럼 헤더와 의미가 어긋난다.

엄밀히 11건 중 진짜 결정된 것은: Q1(자연어 default), Q3 email channel(SES default + EML fallback — 단 Phase 0 PoC 결과로 뒤집힐 여지), Q5(history resource), Q6(95/99), Q7(ZBROS workspace), Q8(검증자 내부), Q10(품질 트리거), Q11(Principle 3 표현) = 8건. Q2/Q4/Q9 3건은 "결정 시점만 정해진 deferred"다.

**요구**: 표 컬럼 헤더를 "v0.3 처리"로 바꾸고, Q2/Q4/Q9 행에 "deferred to Phase 0 PoC / Phase 4" 라벨 명시. plan-approval 시점에서 "11건 모두 해소"라는 v0.3 자평은 over-claim. 이건 Critic의 신뢰 비용을 갉아먹기 때문에 표현 정정 필요.

### 2.3 Phase 0 자체 acceptance 누락 — **경고**

질문 직접 인용: "P0 산출물도 lint·resource 등록 검증 등 테스트가 있어야 하지 않나?"

확인: AC 표(L362–380)에 Phase 0 산출물 검증이 분산되어 있음:

- AC #10: layer-rules + ESLint zone (Phase 0 산출물)
- AC #15: Cost ceiling 정책 결정 + Slack 알림 동작 (Phase 0 + Phase 3)
- AC #2: 6 광고주 fixture 파싱 100% (Phase 1) — Phase 0 fixture 추출은 입력 단계

그러나 다음 Phase 0 산출물의 acceptance가 **누락**:

- Resource 등록(`naver-ads://client-mappings`, `naver-ads://history/{client}`) 검증 — `mcp.list_resources()`로 노출 확인
- 6 광고주 컬럼 매핑(`client-mappings.json`) 스키마 검증
- Anthropic API ping 성공
- `qa+naver-mcp@zbros.co.kr` inbox 도착 검증
- history JSONL 스키마(SHA256 PII hashing) 결정성 unit test

테스트 카운트는 P0이 0인 상태로 209 → 267 도달이 가능하지만, **Phase 0 완료 게이트로서 객관적 testable acceptance가 약함**. 현재 "PoC 3개 결과 문서 + 채널/임계값 결정 문서 + ..." 식의 산문 게이트만 있다. **Phase 0 acceptance 3~5개를 AC 표에 명시 추가** 권장 (예: AC #16 P0 resource 등록 + Anthropic ping + qa inbox 검증).

### 2.4 테스트 카운트 산수 검증 — ✅ 통과

질문 직접 인용: "P1 14 + P2 22 + P3 14 + P3.5 8 = 58, 209 + 58 = 267 ≥ 259+. 수학 OK"

확인: AC #1(L366) "Phase별 분배: P1 14+, P2 22+, P3 14+, P3.5 8+ = 58+, 기존 209 + 58 = 267 (목표 259+ 충족)" — 산수 일관. 단 Phase 0 / Phase 4 테스트 추가 분이 0으로 가정됨. 위 2.3 보강 시 P0 테스트 5+ 추가 → 272+로 마진 더 생김.

### 2.5 Concurrency vs hallucination tuning resend — ⚠️ 마이너 충돌

질문 직접 인용: "v0.3 added §Concurrency with `(client, week) lock + 발송 1회 정책 + force-resend flag`. Does this conflict with §Phase 4 hallucination tuning that may require resend?"

검증:

- §Concurrency L315: "재발송은 명시적 `--force-resend=true` flag 필요"
- §Phase 4 (L223): "hallucination 임계값 95% → 99% 단계 게이트"

Phase 4 tuning은 **임계값 변경**이지 **재발송**이 아니다. 99% 게이트로 올린 후에는 신규 prepare/send만 적용되므로 resend는 필수가 아니다. 단 Phase 4 AE 파일럿 중 hallucination 사고로 인해 광고주에 발송된 리포트를 정정 발송할 경우 force-resend가 필요하며, 이는 §Rollback의 "Phase 2 결함" 항목과 §AE Training 워크숍에서 다뤄야 한다. **현재 §AE Training cheat sheet 5개에 force-resend 절차 미포함**. SHOULD-FIX (보강 1줄로 충분).

### 2.6 v0.3 헤더 자기 모순 — 사소

L3: "상태: DRAFT v0.3 (Critic ITERATE 반영, **Critic 재평가 대기**)". 자기 라벨이 v0.3 안에 있는 건 OK. 단 본 review가 ITERATE 반환하면 다음 라운드에서 v0.4로 헤더 갱신 필요(작은 housekeeping).

---

## 3. ZBROS Phase 1 GO 결재 가능성 점검

질문 직접 인용: "Cost ceiling은 'Phase 0 PoC 측정 후 결정' — 이게 plan-approval 차단이 아닌가? 결재 라인 USD가 빠진 채로 ZBROS가 Phase 1 GO를 줄 수 있는가?"

**결론**: 차단이다.

근거:

- ZBROS 결재 라인은 plan-approval 시점에 "월 USD ≤ X" 형태로 사전 합의되지 않으면, Phase 0 PoC 비용 자체가 누가 승인할 것인가의 책임 공백 발생
- Phase 0 PoC가 실측 후 ZBROS 결재 라인을 결정한다면, "Phase 0 산출물 = Phase 1 GO 게이트"가 되고, 이때 결재 라인 미충족 시 Phase 1 미진행이라는 명시 분기 필요
- 현재 plan은 "Phase 0 → Phase 1"을 묵시적으로 자동 진행으로 표현. ZBROS 결재 절차가 빠짐

**보강안**:

- Phase 0 완료 기준에 "**ZBROS 결재 라인 USD/월 서면 합의(Phase 1 GO 게이트)**" 명시 추가 (L163)
- Phase 1 첫 줄에 "**Phase 0 ZBROS 결재 합의 완료 후 진입**" 의존 명시
- AC #15에 "결재 합의 서명 문서 1건" 명시

이 보강 없이 Critic은 APPROVE 줄 수 없다. "측정 후 결정"은 정당하지만 "측정 후 결정 + 결재 라인 합의 + Phase 1 진입"이 명시 단계여야 한다.

---

## 4. 정합성 추가 점검

### 4.1 AC와 Verification step 매핑 — ✅ OK

AC 15개 vs Verification 13개 — 1:1 매핑은 아니나 모든 AC가 verifiable 도구에 매칭됨. AC #6(AE 만족도)만 자동 회귀 불가지만 익명 설문 절차 명시되어 acceptable.

### 4.2 Resource fallback 경로 — ✅ OK

L48 Option C 무효화 + L353 Risk "Artifact payload budget" mitigation에서 resource fallback 명시 일관. Phase 0 PoC가 실제로 resource fallback 트리거 여부를 측정하는 게 acceptance에 박혔는지는 미확인 — Phase 0 PoC #1이 "한계 초과 시 fallback"으로 명시됨(L140). OK.

### 4.3 보안 회귀 grep 패턴 정확성 — ✅ OK

L398 / L232 패턴 `(secretKey|accessLicense|sk-ant-)` — `accessLicense`는 Naver, `sk-ant-`는 Anthropic, `secretKey`는 Naver SECRET_KEY. 3종 자격증명 커버. CLAUDE.md L67–69 (enumerable:false 정책)와 일관.

### 4.4 history JSONL 스키마 PII 최소화 — ✅ OK

L157: `recipient`·`subject`는 SHA256 해시. PII 노출 최소화. SECURITY.md 정책과 일관.

---

## 5. Verdict

### 판정: **ITERATE** (3 must-fix)

v0.3는 v0.2 critic 7+4건을 거의 모두 흡수했고 운영 절(observability, cost, rollback, concurrency, training, test data)이 plan에 박혔다. 큰 그림과 phase 분할은 견고하다. **그러나 Phase 1 GO 게이트로 쓸 수 없는 3건의 차단·경고가 남아 있다.**

#### MUST-FIX v0.3→v0.4 (3건)

1. **Phase 0 게이트에 ZBROS 결재 라인 USD 합의 명시** (L163 완료 기준 + L165 Phase 1 의존성 + AC #15 보강). USD ceiling 미정인 채로 plan-approval 진행 시 Phase 0 PoC 비용 자체가 책임 공백.
2. **8.5주 일정 병렬 가정 명시** (L238). 9주를 8.5주로 줄이는 병렬 구간을 1줄로라도 표시. 안 하면 Phase 1 GO 시 일정 리스크 측정 불가.
3. **Phase 0 acceptance 3~5개 AC 표에 추가** (resource 등록 + client-mappings 스키마 + Anthropic ping + qa inbox + JSONL 스키마 결정성 unit test). 현재 Phase 0 완료 게이트가 산문이라 회귀 불가.

#### SHOULD-FIX v0.3→v0.4 (2건)

4. **Resolved Questions 표 컬럼 헤더 정정** ("v0.3 결정" → "v0.3 처리"), Q2/Q4/Q9는 "deferred to Phase 0/4" 라벨로 명시. "11건 모두 해소" 자평 over-claim 정정.
5. **AE Training cheat sheet에 `force-resend` 절차 1줄 추가** (L333). hallucination 사고 정정 발송 시 절차 공백 보완.

#### 위 3 + 2 반영 v0.4 → APPROVE 가능

큰 그림은 흔들림 없으니 v0.4는 마무리 라운드. ADR 채우기 직전 단 한 라운드.

---

## 6. APPROVE 줄 수 없는 핵심 이유 1줄 요약

ZBROS 결재 라인 USD가 plan-approval 시점에 미정인 상태로 Phase 0 PoC가 그 결정을 산출한다는 구조는, **결재 책임자 부재 상태에서 Phase 0가 자력 진행**된다는 뜻이고, 이는 6 광고주 운영 사고 발생 시 책임 소재 공백으로 직결된다. 이 한 줄이 해결되면 나머지는 housekeeping이다.
