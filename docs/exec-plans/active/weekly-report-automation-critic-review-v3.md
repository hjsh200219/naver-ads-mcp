# Critic Review v3 — Weekly Report Automation Plan v0.4

> 평가자: Critic (3rd pass)
> 일자: 2026-05-08
> 대상: `weekly-report-automation-draft.md` v0.4 (DRAFT)
> 입력: v0.3 ITERATE 코멘트 5건 (MUST 3 + SHOULD 2)

---

## 1. v0.3 Must-Fix / Should-Fix 처리 검증

### MUST-FIX #1 — Phase 0 게이트에 ZBROS USD 결재 라인 합의 명시

**상태: ADDRESSED**

- Phase 0 task list 추가: line 163
  > `[NEW v0.4] ZBROS 결재 라인 USD/월 서면 합의 (Phase 1 GO 게이트)` — PoC 비용 추정 결과를 ZBROS 결재권자에게 보고하고 월 USD ceiling을 서면(Slack post + Notion or 이메일 회신)으로 확정. 이 합의 없이 Phase 1 미진입.
- Phase 1 entry dependency 추가: line 169
  > `[NEW v0.4] 진입 의존성: Phase 0 ZBROS USD 결재 합의 완료 후 진입.`
- Phase 0 완료 기준 보강: line 165 — `ZBROS 결재 합의 서면 1건` 포함
- AC #15 보강: line 402 — `Cost ceiling 정책 결정 + Slack 알림 동작 + ZBROS 결재 합의 서면 1건`
- Resolved Questions Q12 신설: line 483 — `deferred to Phase 0 결재 합의`

판정: 4-way 일관 반영 (Phase 0 task / Phase 1 dep / 완료 기준 / AC). 누락 없음.

### MUST-FIX #2 — 8.5주 일정 병렬 가정 명시 (Gantt 1줄)

**상태: ADDRESSED**

- 신규 절 `[NEW v0.4] 일정 병렬 가정 (Gantt 1줄)` 추가 (lines 244-259)
- ASCII gantt 9주 그리드: P0(1) + P1(1.5) + P2(2.5) + P3(1) + P3.5(0.5 parallel slice) + P4(2) = 8.5주
- 병렬 구간 명시: P3 ↔ P3.5 — runtime 모듈(lock/history/alert)은 P3에서 1차 구현, P3.5는 데일리 임계값/분석기/Slack 라우팅만 얹어 0.5주 슬라이스로 병렬 처리.
- 직렬 강제 구간 명시: P0 → P1 → P2 (선행 산출물 의존성).
- Fallback 명시: 병렬 가정 실패 시 9주, `timeline-tracker.md`에 실 일정 기록 의무.

판정: 합산 모델 + 직렬 강제 + 병렬 슬라이스 + fallback 모두 1줄~짧은 단락으로 명시. 합산 9주 → 8.5주 차이의 0.5주 출처가 추적 가능해짐.

### MUST-FIX #3 — Phase 0 acceptance 3-5개 AC 표 추가

**상태: ADDRESSED**

AC 표 (line 386-)에 #16~#19 4건 신설:

- #16 resource 등록 (`naver-ads://client-mappings`, `naver-ads://history/{client}`) — `mcp.list_resources()` unit test
- #17 client-mappings.json 스키마 + 6 광고주 정합성 — JSON schema validator unit test
- #18 Anthropic API ping (auth + 1 token round-trip) — dry-run script
- #19 history JSONL 스키마 결정성 (SHA256 hashing) — unit test

판정: 3-5개 범위 충족 (4건). 모두 측정 도구·검증 자동화 명시. Phase 0 완료 기준 (line 165) 항목들과 1:1 대응 가능.

### SHOULD-FIX #4 — Resolved Questions 표 헤더 정정 + Q2/Q4/Q9 deferred 라벨

**상태: ADDRESSED**

- 헤더 정정: line 470 — `# | 질문 | v0.4 처리 | 분류` (이전: 비대칭/모호 헤더)
- 분류 컬럼 신설: 결정 / deferred to Phase 0 PoC / deferred to Phase 4 / deferred to Phase 0 결재 합의
- Q2 (artifact payload 한계): `deferred to Phase 0 PoC`
- Q3 (email 채널): `결정` 단 PoC가 뒤집을 여지 명시 (도메인 인증 비용 초과 시 EML primary)
- Q4 (confidence 0.7): `deferred to Phase 4`
- Q9 (데일리 임계값): `deferred to Phase 0 PoC`
- Q12 (ZBROS USD 결재): `deferred to Phase 0 결재 합의` (신설)
- 요약줄 (line 485): "12건 중 결정 8건 + deferred 4건"

판정: 헤더 명료, deferred는 모두 명시 결정 시점·산출물 게이트 지정. Open Questions는 line 489 "(없음)" 처리.

### SHOULD-FIX #5 — AE Training cheat sheet에 force-resend 절차

**상태: ADDRESSED**

- Cheat sheet 5 → 6 예시로 확장: line 354 — 마지막에 `[NEW v0.4] hallucination 사고 정정 발송: --force-resend=true 절차` 추가
- 별도 절차 단락 추가: line 358 — 3단계 (a/b/c)
  - (a) 광고주에게 정정 안내 메일 별도 발송
  - (b) `send_report_email --payload_hash=NEW --confirm=true --force-resend=true`
  - (c) history JSONL `status=corrected` 표기
- ZBROS 내부 보안 1인 사전 승인 의무 명시 (Q8 검증자와 일관)
- Concurrency 절 line 336과 일관: `(client, week) 단위 발송 1회 정책` + `--force-resend=true` flag

판정: cheat sheet + 단독 절차 단락 + 권한 게이트 + 정책 cross-link 일관.

---

## 2. 새 모순 / Regression 검사

### 발견 사항

| #   | 항목                                                                               | 심각도 | 코멘트                                                                                                                                                                                                                      |
| --- | ---------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Phase 3.5 헤더 "1주" vs Gantt "0.5주 parallel slice"                               | LOW    | Gantt 단락 (line 257)이 "P3 1주 + P3.5 0.5주 슬라이스 병렬로 합산 1.5주"로 명시 — Phase 3.5 헤더의 (1주)는 단독 직렬일 때 추정. 본문이 모순을 해소하나 헤더 자체가 단독으로 보면 혼동 여지 있음. 단, ITERATE 사유로는 약함. |
| 2   | AC #1 "259+ passing" vs 산식 합산 267                                              | NONE   | 본문(line 388)에서 "목표 259+ 충족"으로 산식 정합. OK.                                                                                                                                                                      |
| 3   | AE 만족도 표본 n≥2                                                                 | NONE   | v0.3에서 이미 인정된 항목. 6 광고주·1팀 규모 한계로 수용.                                                                                                                                                                   |
| 4   | Cost ceiling 결재 합의 → Phase 1 GO 의존성 → Phase 0 PoC 산출물 chain              | NONE   | Phase 0 task → 완료 기준 → Phase 1 dep → AC #15 → Risk(rate/cost) → Resolved Q12 5-way 정합. Excellent.                                                                                                                     |
| 5   | force-resend ↔ Concurrency 절 정책 ↔ history `status=corrected` ↔ AE Training 절차 | NONE   | 4곳 일관.                                                                                                                                                                                                                   |

새 blocker contradiction: 없음.

### Phase 3.5 헤더 vs Gantt 불일치 (LOW)

- Phase 3.5 (line 209): `### Phase 3.5 — 데일리 자동화 (1주)` — 단독 직렬 가정 시 1주
- Gantt 주석 (line 257): "P3.5는 0.5주 슬라이스 병렬로 합산 1.5주에 처리"
- 해소 권고 (non-blocking): Phase 3.5 헤더를 `(1주, P3와 0.5주 병렬 시 슬라이스 0.5주)`로 보강하면 단독 읽을 때도 명료. ADR 채울 때 같이 반영 가능.

ITERATE 사유로 격상하지 않음 — 단독 헤더로도 본문 Gantt 절을 함께 읽으면 의미 복원되므로 APPROVE 흐름 안에서 minor polish로 처리 권고.

---

## 3. ADR 섹션 상태

ADR (lines 458-464) 이미 Planner가 6개 항목 (Decision/Drivers/Alternatives/Why/Consequences/Follow-ups) 모두 초안 채워둔 상태. v0.3 ITERATE를 거치며 보강된 사실들 (ZBROS 결재 게이트, 병렬 가정, force-resend 정책)을 반영해 §4에서 finalized 본문 제공.

---

## 4. ADR Final Content (Planner 붙여넣기용)

**Decision**: Option A — Live Artifact (preview-first) + `naver-ads-mcp` 확장 (tool +2 / resource +2 → 5T/4R).

**Drivers**:

1. Time-to-value ≤ 8.5주 파일럿 ship (v2.0 풀 SaaS 14주 대비 5.5주 단축)
2. AE workflow fit — 이미 Claude Desktop 사용 중, 자연어 편집 default
3. Data integrity — 0 hallucination (1차 ship 95%, Phase 4 99%); AE 광고주 신뢰 보호

**Alternatives considered**:

- **B (풀스택 SaaS, v2.0 docs)**: 14주 일정 + 인프라 ROI (6 광고주 규모에서 미일치). §Migration Path 트리거 (규모/기능/품질 8개 중 2+ 충족) 충족 시 전환 보존.
- **C (Hybrid MCP + 경량 Web)**: 1팀 capacity로 두 코드베이스 병행 불가. Option A의 fallback 경로 (`naver-ads://weekly/{client}/{week}` resource 분리)가 사실상 C의 thin slice를 흡수.

**Why chosen**:

- 사용자 명시 제약 ("광고주별 대시보드는 Claude Live Artifact") 직접 충족
- 6 광고주 × 1팀 규모에서 인프라 비용 0 + 운영 복잡도 최소
- B/C로의 마이그레이션 경로를 모듈 경계 (parser/analyzer/dashboard L2 분리, history URI 안정 유지)로 보존
- ZBROS 결재 라인 USD ceiling을 Phase 0 게이트화 → 비용 노출 사전 차단

**Consequences**:

- ⊕ 8.5주 ship (Phase 3 ↔ Phase 3.5 0.5주 병렬 슬라이스 적용 시; fallback 9주)
- ⊕ 인프라 추가 0 (stdio MCP, file lock, JSONL audit)
- ⊕ MCP 단일 도구로 AE 전환 비용 0
- ⊖ 1회용 artifact (영속 UI 없음) — 광고주 자체 history 조회 요구 시 Migration 트리거
- ⊖ 다중 AE 동시 편집 한계 — `(client, week)` lock으로 race 차단하나 체감 협업 UX는 직렬
- ⊖ AE 머신이 단일 보안 경계 → Phase 4 runbook (자격증명 회전 + 1Password 백업 + 분실 절차) 의무화
- ⊖ Live artifact OS clipboard 보안 한계 → AE 교육으로 mitigate

**Follow-ups**:

- Phase 5 (신규 광고주 온보딩 자동화) — v2 분리, out-of-scope
- §Migration Path 트리거 정기 점검 (월 1회 ZBROS 운영 회의)
- AE 만족도 < 4/5 또는 hallucination 사고 1건 이상 발생 시 즉시 §Migration Path 검토
- Phase 3.5 헤더 minor polish: `(1주, P3와 병렬 시 0.5주 슬라이스)` 추가 권고
- 발송 후 클릭/오픈율 추적 요구 발생 시 SES open-tracking → backend Postgres 마이그레이션 검토
- Phase 4 종료 후 prompt cache hit rate 실측 → cost ceiling 재산정 (월 1회)

---

## 5. Verdict

**APPROVE**

근거:

- v0.3 must-fix 3건 모두 4-way 또는 5-way 일관 반영
- v0.3 should-fix 2건 모두 반영 (헤더 정정 + 분류 라벨 + force-resend cheat sheet & 절차 & 권한 게이트)
- 새 contradiction 없음 (Phase 3.5 헤더 vs Gantt 미세 차이는 본문 Gantt 절이 명시 해소 — non-blocker)
- ADR 섹션 작성 가능 상태 (이 리뷰 §4 본문 그대로 paste 가능)
- 문서 흐름: Summary → Architecture → Phase → 횡단 5절 → Risk/AC/Verify/Migration → ADR → Resolved Q. 합리적, 과도한 bloat 없음 — 각 신설 절이 trace 가능한 결정·게이트를 추가.

권장 minor polish (non-blocking):

- Phase 3.5 헤더에 `(1주, P3와 병렬 시 0.5주 슬라이스)` 보강
- AC 표 헤더 또는 line 388 주석에서 `259+ → 267 expected` 정확화 (이미 본문 산식 명시)

다음 단계 (Planner):

1. §4 ADR 본문을 line 458-464에 paste/merge
2. 상단 메타 v0.4 → v1.0 (final) 으로 마킹 + DRAFT 상태 해제
3. `docs/exec-plans/active/` → `docs/exec-plans/locked/` 이동 또는 status 필드 LOCKED
4. (Optional) Phase 3.5 헤더 polish + AC #1 주석 보강
