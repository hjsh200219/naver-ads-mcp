# helloMAX Weekly Report Automation — Plan v1.3 (FINAL)

> 상태: **FINAL v1.3** (v1.2 + 사용자 결정 3건 — O1 택스아이 정리·O2 1인 일정·artifact preview only 채택)
> 작성: 2026-05-08, 갱신: 2026-05-09
> v1.2 변경점: ZBROS USD 결재 합의 게이트 전부 제거. 비용 모니터링은 visibility 알림만 유지(상한선·승인 절차 없음). Phase 1 GO는 PoC 산출물만 충족하면 진입.
> v1.3 변경점: (1) O2 dev=1인 결정 → 일정 8.5주 → **12주** fallback + scope 단순화 (2) O1 답: 택스아이 "비완전"은 Naver API 한계(브랜드검색 영역별 미지원), 단순 데이터 표기로 처리 (3) Codex 제안 채택: artifact는 **preview only**, 발송은 EML 파일 export → AE가 메일 클라이언트로 직접 발송. SES 의존 0, send_report_email tool → export_email_draft. artifact↔MCP 콜백 가정 검증 불필요 (Codex 최대 risk 더 약화).
> 입력 자료: docs/references/(사업) 광고운영부서 업무 Workflow 작성*260429.docx, HelloMax*주간리포트*AI코멘트*기획안\_v2.0.docx, hellomax_weekly_comment_sample.html
> 사용자 제약: **광고주별 대시보드는 Claude Live Artifact로 구현**
> v0.3 변경점: Observability/Cost/Rollback/Concurrency/Test-data/Training 절 신설, AC 측정 정의 보강, Open Q1·Q3 결정, Phase 3.5 데일리 분리, Principle 3 표현 정정, B Migration에 품질 트리거 추가
> v0.4 변경점: Phase 0 게이트에 ZBROS USD 결재 합의 명시 + Phase 1 의존성 + AC #15 보강, 일정 병렬 가정 갠트 1줄 명시, Phase 0 acceptance 4건 AC 신설, Resolved Questions 표 헤더 정정 + deferred 라벨, AE Training cheat sheet에 force-resend 절차 추가
> **v1.1 변경점**: Codex Q1(광고주 NDA 외부 API 전송 허용) + Q2(Claude seat = Max) 사용자 답변 반영. Q3(택스아이 누락 고지) + dev 인원은 미해소 (§Open Questions에 명시)

---

## RALPLAN-DR Summary

### Principles (5)

1. **MCP-first** — 새 stack 추가 최소화. 기존 `naver-ads-mcp`(L1~L5) 확장. read-only는 MCP resource로 노출 (token-saving 정책 일관).
2. **Human-in-the-loop, natural-language-edit-default** — 기본 편집 경로는 AE 한국어 지시 → MCP 재호출 → 새 artifact. JSON copy/paste는 opt-in fallback. AI는 초안 생성만, **수치 계산 금지**(파서·MCP가 사전 수행).
3. **Evidenced runs, stateless artifact** — artifact 자체는 stateless (각 회 독립 렌더). 영속 상태는 **확정된 두 곳에 한정**: `payload_hash` LRU 5분 (server memory) + `naver-ads://history/{client}` resource (JSONL on disk). 두 상태는 명시 audit trail.
4. **Data 신뢰가 1순위** — 광고주 리포트 0 hallucination. AI는 **사전 계산된 KPI payload 값만 인용**하도록 system prompt + 출력 검증 강제. 1차 ship 게이트 95% (Open Q1 결정), Phase 4 tuning 99%.
5. **Phased delivery, security-baked, observable** — phase 게이트에 보안 회귀(자격증명 0 노출, 머신 분실 runbook), layer-rules 정합성, observability 알림 default 모두 포함.

### Decision Drivers (Top 3)

1. **Time-to-value (≤ 8.5주 파일럿 ship)** — v2.0 풀 SaaS는 14주.
2. **AE workflow fit** — Claude Desktop 사용 중. 자연어 편집이 default.
3. **Data integrity (0 hallucination)** — 광고주 신뢰 = helloMAX 핵심 자산.

### Viable Options (3) — A 채택

#### Option A — Live Artifact (preview only) + EML export + MCP 확장 ★ 채택 (v1.3)

`naver-ads-mcp`에 **tool 2개 + resource 2개** 추가 (확장 후 5 tools + 4 resources).

| 종류     | 이름                                                 | 사유                                                |
| -------- | ---------------------------------------------------- | --------------------------------------------------- |
| Tool     | `prepare_weekly_dashboard(client, week, revisions?)` | compute action (artifact + EML draft 페이로드 생성) |
| Tool     | `export_email_draft(payload_hash)` (v1.3 변경)       | EML 파일을 로컬 디스크에 저장 (광고주 직접 발송 X)  |
| Resource | `naver-ads://client-mappings`                        | read-only metadata                                  |
| Resource | `naver-ads://history/{client}`                       | read-only audit log                                 |

흐름 (v1.3): AE → `prepare_weekly_dashboard` → MCP가 KPI 사전계산 + Anthropic → JSON+payload_hash+artifact HTML → Claude **artifact는 preview only로 렌더** → AE 자연어 수정(default) 또는 inline 편집(opt-in) → "발송 준비해줘" → `export_email_draft(hash)` → MCP가 EML 파일을 `~/.naver-ads-mcp/drafts/{client}/{week}.eml`에 저장 + history JSONL append → **AE가 Finder/Spotlight에서 EML 파일 열어 Gmail/Outlook으로 직접 발송**.

### v1.3에서 단순화된 것

- ❌ SES/SMTP 도메인 인증·DKIM/SPF 부담 → 0 (서버에서 광고주에게 직접 안 보냄)
- ❌ artifact↔MCP 콜백 가정 → 검증 불필요 (artifact는 시각화만)
- ❌ Codex 최대 risk(외부 LLM 전송) — 광고주 PII는 여전히 Anthropic으로 가지만, 발송 자체는 AE 메일 클라이언트라 도메인 신뢰도 손상 risk·서버 분실 시 자동 발송 risk 모두 0
- ❌ 발송 후 5분 status 재확인 → 불필요 (메일 클라이언트가 처리)
- ⊕ 1인 개발에 적합: send/SES/도메인 인증 모듈이 통째로 빠져 4-5주 절감

#### Option B — 풀스택 SaaS (v2.0 docs)

**Invalidation**: 14주 ship vs 사용자 요구 8주. 6 광고주에서 인프라 ROI 안 맞음. 12+ 광고주 OR 다중 AE 동시 편집 OR **AE 만족도 4/5 미만 + hallucination 사고 1건 이상** OR 광고주 자체 history 조회 요구 OR 발송 후 클릭/오픈율 추적 요구 — 이 중 2개 이상 충족 시 §Migration Path로 전환.

#### Option C — Hybrid (MCP + 경량 Web)

**Invalidation**: 1팀 capacity로 두 코드베이스 불가. 단 Option A의 페이로드 fallback("KPI를 `naver-ads://weekly/{client}/{week}` resource로 분리")이 사실상 Hybrid의 thin slice이므로, A는 fallback 경로에서 C를 부분 흡수한다.

---

## Architecture (Option A v1.3)

```
┌─────────────────────────────────────────────────────────┐
│ AE (Claude Desktop)                                     │
│   "비셰프 4월 4주차 리포트" → "ROAS 톤 부드럽게"          │
│   → "EML로 빼줘" → Finder에서 .eml 더블클릭 → Gmail 발송│
└──────────────────┬──────────────────────────────────────┘
                   │ MCP tool/resource
                   ▼
┌─────────────────────────────────────────────────────────┐
│ naver-ads-mcp (확장, v1.3 단순화)                       │
│  L1 mcp/server.ts                                       │
│   Tools     • prepare_weekly_dashboard       [NEW]      │
│             • export_email_draft (v1.3 변경)  [NEW]     │
│             • validate_credentials,                     │
│               fetch_raw_data, generate_report           │
│   Resources • naver-ads://report-types, accounts        │
│             • naver-ads://client-mappings    [NEW]      │
│             • naver-ads://history/{client}   [NEW]      │
│                                                          │
│  L1 runtime helpers (file IO + lock + alert)            │
│   • src/runtime/history.ts          [NEW] atomic append │
│   • src/runtime/eml-export.ts (v1.3) [NEW] EML 파일 빌더│
│   • src/runtime/lock.ts             [NEW] file-based    │
│   • src/runtime/alert.ts            [NEW] Slack webhook │
│   • src/runtime/log.ts              [NEW] structured    │
│   ❌ src/runtime/email-send.ts (v1.2 → v1.3 제거)       │
│                                                          │
│  L2 services (no file IO)                               │
│   • src/parser/excel-template.ts    [NEW] 3-step parse  │
│   • src/parser/precompute-kpi.ts    [NEW] delta/units   │
│   • src/analyzer/ai-comment.ts      [NEW] prompt build  │
│   • src/dashboard/artifact-html.ts  [NEW] HTML 1-file   │
│                                                          │
│  L3 API                                                 │
│   • src/api/anthropic.ts            [NEW] Claude wrapper│
│   ❌ AWS SDK SES (v1.2 → v1.3 제거)                     │
│                                                          │
│  L4 config                                              │
│   • src/config/credentials.ts       (Anthropic 추가,    │
│                                       enumerable:false) │
│   • src/config/client-mappings.json [NEW]               │
│                                                          │
│  L5 types: src/parser/types.ts [NEW]                    │
└─────────────────────────────────────────────────────────┘
```

### Layer-rules 정합성

| Module                             | Layer | 의존 OK                                     | 의존 금지       |
| ---------------------------------- | ----- | ------------------------------------------- | --------------- |
| `src/parser/excel-template.ts`     | L2    | exceljs, L3, L4, L5                         | L1, file IO     |
| `src/parser/precompute-kpi.ts`     | L2    | L5 types                                    | L1, L3, file IO |
| `src/analyzer/ai-comment.ts`       | L2    | L3 anthropic, L5 types                      | L1, file IO     |
| `src/dashboard/artifact-html.ts`   | L2    | L5 types                                    | L1, L3, L4      |
| `src/runtime/history.ts`           | L1    | node:fs, L2 types, L1 lock                  | — (L1 leaf)     |
| `src/runtime/eml-export.ts` (v1.3) | L1    | node:fs, L2 dashboard (HTML→EML)            | —               |
| `src/runtime/lock.ts`              | L1    | node:fs (proper-lockfile)                   | —               |
| `src/runtime/alert.ts`             | L1    | fetch (Slack webhook)                       | —               |
| `src/runtime/log.ts`               | L1    | (no deps)                                   | —               |
| `src/api/anthropic.ts`             | L3    | @anthropic-ai/sdk, L4 credentials, L5 types | L1, L2          |
| `src/config/client-mappings.json`  | L4    | — (data only)                               | —               |

Phase 0 산출물: `docs/design-docs/layer-rules.md` 업데이트 + `.eslintrc` `import/no-restricted-paths` zone 추가 + `npm run lint` 0 violations.

---

## 자동화 우선순위 매핑

| #   | Step                   | 워크플로우 priority | Phase | 산출물                                              |
| --- | ---------------------- | ------------------- | ----- | --------------------------------------------------- |
| 1   | 1-2-① 주간 데이터 취합 | 高                  | 1     | parser/excel-template + Naver API combiner          |
| 2   | 1-2-② Weekly Report    | 高                  | 2     | analyzer + dashboard/artifact-html                  |
| 6   | 1-2-④ 광고주 이메일    | 中                  | 3     | runtime/eml-export (AE 메일 클라이언트로 직접 발송) |
| 3   | 1-1-① 데일리 퍼포먼스  | 高                  | 3.5   | `prepare_daily_dashboard`                           |
| 4   | 1-1-③ 데일리 액션      | 高                  | 3.5   | analyzer 재사용                                     |
| 5   | 1-1-④ 액션 기록·슬랙   | 中                  | 3.5   | history + alert                                     |

신규 온보딩 Part 2 (#7, #8) — out of scope, v2.

---

## Phase Plan (8.5주)

### Phase 0 — 기반 검증 (1주)

- [ ] **PoC 1**: Live artifact ↔ MCP 통신 패턴 검증
  - 6 광고주 KPI 페이로드 평균/최대 크기 측정
  - artifact 토큰/렌더 budget 측정 (Sonnet 4.6 200K context 기준)
  - 자연어 편집 vs JSON copy 라운드트립 vs payload_hash UX 비교 → **default 결정**
  - 한계 초과 시 fallback: KPI를 `naver-ads://weekly/{client}/{week}` resource 분리
- [ ] **PoC 2 (v1.3 단순화)**: EML export 검증
  - RFC 5322 EML 파일 빌드 + 첨부 (원본 엑셀)
  - Mail.app·Outlook·Gmail import 검증 (각 도구에서 정상 표시·발송 가능)
  - 광고주에게 보낼 때 from·reply-to 헤더 처리 (AE 본인 주소)
  - SES/Gmail SMTP 옵션 비교는 v1.3에서 폐기 (AE 직접 발송이 default)
- [ ] **PoC 3**: Cost visibility 추정 (한도·결재 없음)
  - 주간: 6 광고주 × 4주 × 평균 재호출 1.5회 = 월 36 호출
  - 데일리(Phase 3.5): 6 광고주 × 5 영업일 × 4주 = 월 120 호출
  - 합산 월 156 호출 × Sonnet 4.6 평균 토큰 → USD 추정 (참고용)
  - prompt caching 적용 시 cache hit ≥ 80% 가정
  - **알림 정책**: 월 누적 비용이 직전 월 평균 × 2배 초과 시 `runtime/alert.ts` Slack 알림 (visibility용, 차단 없음)
- [ ] **결정**: Slack workspace = **ZBROS 워크스페이스** (Open Q3 해소). 채널 `#hellomax-mcp-alerts` 신설
- [ ] **결정**: Hallucination guard 1차 ship 임계값 = **95%** (review_text 추출 숫자 ⊂ payload 사전계산 필드 비율). Phase 4 tuning 99% (Open Q1 해소)
- [ ] Layer-rules.md 업데이트 + ESLint zone (위 표) + lint pass
- [ ] 6 광고주 컬럼 매핑 (`src/config/client-mappings.json`)
- [ ] Anthropic API 키 → `.env` `ANTHROPIC_API_KEY` + `enumerable:false`
- [ ] history JSONL 스키마: `{week, client, payload_hash, sent_at, recipient_hash, subject_hash, status}` (recipient·subject는 SHA256으로 PII 최소화)
- [ ] resource 등록: `naver-ads://client-mappings`, `naver-ads://history/{client}`
- [ ] **Test fixture 익명화**: `tests/fixtures/anonymized/` 6개 (광고주명·주소·매출 절대값 마스킹). CI에서만 사용. 실 엑셀(`docs/references/`)은 .gitignore 유지
- [ ] **CI mock 정책**: Naver SearchAd API + Anthropic API 둘 다 mock (QUALITY.md 일관). live는 로컬 e2e 전용
- [ ] **발송 테스트 inbox**: `qa+naver-mcp@zbros.co.kr` 지정 (광고주 실주소로 절대 발송 금지 in CI/dev)
- [ ] **[v1.3 단순화] Live Artifact preview 검증** — artifact는 시각화만, MCP 콜백 가정 불필요. PoC에서 (a) Claude Desktop이 artifact HTML을 정상 렌더, (b) AE 자연어 수정 → MCP 재호출 흐름 정상 동작 확인. clipboard·MCP 콜백 검증 항목 제거.
- [ ] **[NEW v1.1] Claude Max seat 사용량 한도 측정** — 월요일 피크에 prepare 9회 + 데일리 6회 = 15회/2시간이 Max plan cap 안에 들어가는지 실측. 초과 시 분산 호출 또는 API 키 이중 채널 검토
- [ ] **[v1.3 단순화] 택스아이 데이터 표기 정책** — Naver brand search 영역별 미지원 셀에 "Naver 미제공" 텍스트 표기 + 합계는 표시. artifact `data_warnings[]` 필드에 영역명 기록. 광고주 별도 안내·footer 알림 절차 없음 (자연스러운 데이터 표기로 처리)
- [ ] **[NEW v1.1] PII 최소화 prompt 설계** — Anthropic 호출 payload에서 (a) 수신자 이메일은 SHA256 hash, (b) 광고주명은 client_id로 마스킹 옵션 (광고주 톤 지키려면 회사명 필요할 수 있어 trade-off 결정), (c) 개인정보위 2025 생성형 AI 안내서 점검 1회

**완료 기준**: PoC 3개 결과 문서 + 채널/임계값 결정 문서 + layer-rules update + ESLint pass + Anthropic ping + 6 매핑 + fixture 6개 + CI mock 통과.

### Phase 1 — Excel 파서 (1.5주)

> **진입 의존성**: Phase 0 산출물(PoC 3건 + 매핑·fixture·CI mock) 충족 후 진입. 결재·승인 게이트 없음.

- [ ] `src/parser/excel-template.ts` 3단계 파싱
- [ ] `src/parser/precompute-kpi.ts` — 절대값 + 증감률 + 단위 변환 사전 계산
- [ ] `src/api/types.ts` + `src/parser/types.ts` 표준 KPI 타입
- [ ] 6 광고주 fixture 파싱 unit test (성공률 100% 게이트)
- [ ] 예외 처리: 수식 셀 data_only / 병합 셀 / `#DIV/0!` / 증감률 형식 통일
- [ ] **Race test**: 같은 client·week 동시 파싱 시 결과 deterministic (payload_hash 결정성 검증)

**완료 기준**: vitest 6/6 fixture 100%, 신규 14+ tests, payload_hash 결정성 테스트 통과.

### Phase 2 — AI 분석 + Live Artifact (2.5주)

- [ ] `src/api/anthropic.ts` — Sonnet 4.6 + prompt caching (system + few-shot)
- [ ] `src/analyzer/ai-comment.ts` — 시스템 프롬프트 + Few-shot(패션포유) + 출력 검증
- [ ] **Hallucination guard 2단계**:
  - (a) review_text 추출 숫자 ⊂ payload 사전계산 필드 (절대값 + 증감률 + 단위변환)
  - (b) ≥ 95% 비율(1차 ship) → CI gate; <95% 시 confidence -0.3
- [ ] `src/dashboard/artifact-html.ts` — 비셰프 샘플 베이스, 외부 fetch 0
- [ ] MCP tool `prepare_weekly_dashboard(client, week, revisions?)` + integration test
- [ ] payload_hash = SHA256(canonical_payload + timestamp_minute) 결정성 + LRU 5분
- [ ] **AE UX**: 자연어 편집 default + opt-in inline 편집 (Phase 0 PoC 결과)
- [ ] artifact 상단 confidence 배지 (≥ 0.7 hidden, < 0.7 경고)
- [ ] **artifact "정상 렌더" 객관 정의**: (a) DOM 노드 수 ≥ 100, (b) 콘솔 에러 0건, (c) 6 KPI 카드 + 매체 분리 + insights ≥ 3 + actions ≥ 3 모두 존재 (snapshot test)

**완료 기준**: 비셰프·택스아이 실데이터로 artifact 1회 정상 렌더 + AE 1명 사용 후 PR 승인 + hallucination guard 6/6 fixture 95% 이상 + 신규 22+ tests.

### Phase 3 — EML 파일 export + 인프라 (0.5주, v1.3 단순화)

- [ ] `src/runtime/eml-export.ts` (v1.3) — artifact JSON → RFC 5322 EML 빌더 (HTML 본문 + 원본 엑셀 첨부 + To/Cc/Subject 헤더)
- [ ] `src/runtime/lock.ts` — `(client, week)` 단위 file lock (proper-lockfile)
- [ ] `src/runtime/history.ts` — atomic append (write temp + rename) + JSONL 스키마. 발송 시점이 아니라 **EML export 시점** 기록(status=draft_exported)
- [ ] `src/runtime/alert.ts` — Slack webhook (#hellomax-mcp-alerts)
- [ ] `src/runtime/log.ts` — 구조화 JSON line (level, request_id, client, week, op, latency_ms)
- [ ] MCP tool `export_email_draft(payload_hash)` — hash 검증 + lock + EML 파일을 `~/.naver-ads-mcp/drafts/{client}/{week}.eml`로 저장
- [ ] **Concurrency 테스트**: 같은 (client, week) 동시 export 2건 → 1건만 통과, 1건 lock 거절. 같은 hash 재호출은 idempotent (덮어쓰기)
- [ ] AE 발송 절차 문서: `open ~/.naver-ads-mcp/drafts/{client}/{week}.eml` → Mail.app/Outlook에서 검토 → 발송

**완료 기준**: 6 광고주 fixture로 EML 파일 정상 생성 + Mail.app/Gmail import 검증 + history JSONL atomic append + concurrency 테스트 통과 + 신규 12+ tests.

### Phase 3.5 — 데일리 자동화 (1주, P3와 병렬 시 0.5주 슬라이스)

- [ ] `prepare_daily_dashboard(date)` — 6 광고주 KPI 임계값 검사 + 이슈 광고주 자동 정렬
- [ ] 임계값 정의 (Phase 0 PoC 합의): ROAS -20% MoM, CPC +30% MoM, 노출 -50% DoD 등
- [ ] 이슈 광고주 데일리 액션 추천 (analyzer 재사용)
- [ ] 데일리 발견 자동 Slack 알림 (#hellomax-mcp-alerts)
- [ ] **데일리 acceptance 3개**:
  - (a) 데일리 호출 응답 ≤ 60초
  - (b) 6 광고주 임계값 위반 자동 검출 100% (fixture 기준)
  - (c) Slack 알림 발송 성공 (qa 채널 별도)

**완료 기준**: 데일리 acceptance 3건 + 신규 8+ tests.

### Phase 4 — AE 파일럿 + 보안 + 교육 (2주)

- [ ] AE 2~3명 실사용 (2주간 6광고주)
- [ ] **AE 교육 워크숍 1회 (2시간)**: 자연어 편집 cheat sheet 5개 예시 + artifact preview 사용법 + EML 발송 절차 (Mail.app/Outlook/Gmail import)
- [ ] **매뉴얼 검증 acceptance**: AE 1명이 매뉴얼만 보고 1광고주 발송 성공
- [ ] 프롬프트 튜닝 (AE 피드백 5점 척도: 정확성/유용성/톤. 익명 설문, 표본 ≥ 2명, 항목 8개)
- [ ] hallucination 임계값 95% → 99% 단계 게이트
- [ ] 매핑 예외 보완
- [ ] 운영 매뉴얼 (README.md 추가 섹션)
- [ ] **머신 분실/AE 교체 runbook** (`docs/SECURITY.md` 보강 + 본 plan 양방향 cross-link)
  - 자격증명 회전 (Naver / Anthropic) — 각 서비스별 콘솔 URL + 절차 (SES 제거됨, v1.3)
  - history JSONL + drafts/ 백업 정책: **주 1회 1Password Secure Note** (외부 안전 저장소)
  - AE 교체 시 인계 체크리스트 (10항목)
  - **검증자**: ZBROS 내부 보안 1인 + AE 1인 (Open Q2 해소: 내부)
- [ ] 보안 회귀 자동: `grep -rE "(secretKey|accessLicense|sk-ant-)" ~/.naver-ads-mcp/ logs/` → 0건 (CI script)

**완료 기준**: AE 만족도 평균 4/5 (표본 ≥ 2명, 익명) + EML draft → AE 발송 6/6 성공 + 0 hallucination 인스턴스 + 매뉴얼 검증 통과 + runbook PR merge.

### (Out of scope, v2) Phase 5 — 신규 광고주 온보딩

총 **약 8주 (1인 개발, v1.3 단순화 반영)**. v1.2의 8.5주에서 Phase 3가 1주 → 0.5주로 단축되어 8주.

### 일정 (Gantt, 1인 개발)

```
주차    1   2   3   4   5   6   7   8
P0  ███
P1      █████████          (1.5주)
P2          ████████████████  (2.5주)
P3                          ████  (0.5주, EML export·인프라)
P3.5                            ████████  (1주, 데일리)
P4                                      ████████████████  (2주)
```

**v1.3 단순화 효과**:

- Phase 3 EML export는 `email-send.ts` 대비 단순 (RFC 5322 빌더 + 파일 저장만) → 1주 → 0.5주
- SES 도메인 인증 + DKIM/SPF 관련 작업 0
- 발송 후 5분 status 재확인·bounce 처리 0
- artifact↔MCP 콜백 검증 항목 0

**1인 risk 완화 (직렬 강제, 병렬 환상 제거)**:

- Phase 0~4 모두 직렬. v1.2의 P3↔P3.5 0.5주 병렬 슬라이스 가정 폐기 (1인이라 병렬 불가)
- 일정 슬리피지 발생 시 데일리(Phase 3.5)를 v2로 후퇴 → **6주에 v1.0 ship 가능**(주간 리포트만, 데일리 후속)
- 슬리피지 추적: Phase 시작 시 `docs/exec-plans/active/timeline-tracker.md`에 실 일정 기록

---

## Observability (NEW §)

### 로그 포맷 표준

```json
{
  "ts": "2026-05-08T13:00:00.000+09:00",
  "level": "info",
  "request_id": "req-...",
  "op": "prepare_weekly_dashboard",
  "client": "bishef",
  "week": "2026-W18",
  "latency_ms": 12345,
  "status": "ok"
}
```

- 모든 MCP tool 진입/종료에서 1줄씩 emit
- 자격증명 필드는 `enumerable:false`로 직렬화 시 자동 제외 (기존 패턴)
- 출력: stdout (Claude Desktop이 캡처) + `~/.naver-ads-mcp/logs/{YYYY-MM-DD}.jsonl`

### 알림 채널

| 이벤트                           | 채널                                               | 트리거                   |
| -------------------------------- | -------------------------------------------------- | ------------------------ |
| 발송 성공                        | Slack `#hellomax-mcp-sends`                        | 매 발송                  |
| 발송 실패 (5분 재확인 후)        | Slack `#hellomax-mcp-alerts`                       | 자동                     |
| Anthropic 에러 (rate limit, 5xx) | Claude Desktop 화면 + Slack `#hellomax-mcp-alerts` | 즉시                     |
| Hallucination guard < 95%        | Slack `#hellomax-mcp-alerts`                       | 즉시                     |
| 비용 급증 (전월 평균 ×2 초과)    | Slack `#hellomax-mcp-alerts`                       | 일 1회 검사 (visibility) |
| history JSONL append 실패        | throw + Slack                                      | 즉시                     |

### AE 화면 표면화

- Anthropic 에러: artifact 대신 에러 텍스트 + 재시도 버튼 + Slack 자동 통보
- 발송 실패: Claude 응답에 "❌ 발송 실패. Slack 알림 확인" + history JSONL `status=failed` 기록

---

## Cost Visibility (v1.2 — 한도/결재 없음, 가시성만)

### 추정 (Phase 0 PoC에서 실측, 참고용)

| 항목               | 월 호출 | 평균 input 토큰 | 평균 output | 추정 USD/월      |
| ------------------ | ------- | --------------- | ----------- | ---------------- |
| 주간 (재호출 1.5x) | 36      | 8K (cache 80%)  | 2K          | TBD Phase 0      |
| 데일리             | 120     | 4K (cache 80%)  | 1K          | TBD Phase 0      |
| **합계**           | 156     | —               | —           | **TBD (참고용)** |

### 모니터링 정책 (차단·승인 없음)

- **상한·결재 게이트 없음** (v1.2 결정)
- 일 검사 cron: 그 달 누적 비용이 직전 월 평균 × 2배 초과 → Slack 알림 (visibility)
- 비용 급증 시 운영자 판단으로 emergency: `MCP_DISABLE_DAILY=1` env flag로 데일리 OFF (rollback §)

---

## Rollback (NEW §)

### Phase별 1줄 rollback

| Phase | 결함 시 즉시 rollback                                                                   |
| ----- | --------------------------------------------------------------------------------------- |
| 0     | resource/config 추가뿐 → `git revert` 안전                                              |
| 1     | parser regression → 이전 fixture 비교 + revert                                          |
| 2     | hallucination 사고 → `MCP_DISABLE_PREPARE=1` env flag로 tool OFF, AE 수동 작성 fallback |
| 3     | EML 빌더 결함 발견 시 → `MCP_DISABLE_EXPORT=1` toggle, AE는 기존 수동 작성으로 복귀     |
| 3.5   | 데일리 false positive 폭증 → `MCP_DISABLE_DAILY=1`                                      |
| 4     | runbook 키 회전 실수 → 이전 키 (1Password 보관) 복원                                    |

### 광고주별 opt-out

- `client-mappings.json`에 `automation_enabled: false` 필드. 즉시 해당 광고주만 OFF.

---

## Concurrency (NEW §)

- **Lock**: `(client, week)` 단위 advisory file lock via `proper-lockfile` (Phase 3 `src/runtime/lock.ts`). prepare/send 모두 lock 획득.
- **payload_hash**: `SHA256(canonical_payload + timestamp_minute)` — 분 단위 결정성. 같은 입력 + 같은 분 → 같은 hash. LRU 5분.
- **Hash 만료 UX**: 만료 hash로 send 시도 → 거절 + AE에게 "review 만료. 다시 검토 후 발송" 메시지 + 자동 prepare 재호출 옵션.
- **History append**: temp file write + rename (POSIX atomic). 동시 append는 lock 획득 후 직렬화.
- **(client, week) 단위 발송 1회 정책**: 같은 (client, week) 발송 history 존재 시 새 hash라도 거절 (광고주 이중 수신 방지). 재발송은 명시적 `--force-resend=true` flag 필요.

---

## Test Data + CI 정책 (NEW §)

- 실 광고주 엑셀: `docs/references/`에 보관, .gitignore + .claudeignore 등록 유지 (보안)
- 익명 fixture: `tests/fixtures/anonymized/` 6개 — 광고주명·주소·매출 절대값 마스킹, 구조 유지
- CI: 익명 fixture만 사용. 실 데이터 절대 미업로드
- API mock: Naver SearchAd + Anthropic API 둘 다 mock (vitest msw). live 호출은 로컬 e2e 전용 (`npm run e2e`)
- 발송 테스트 inbox: **`qa+naver-mcp@zbros.co.kr`** (광고주 실주소 절대 금지 in CI/dev)
- E2E run gate: 환경변수 `NAVER_ADS_E2E=1` + `qa+...` inbox 검증된 경우만

---

## AE Training (NEW §, Phase 4 산출물)

- **워크숍 1회 (2시간)**:
  - 자연어 편집 예시 cheat sheet **6개** (톤 부드럽게 / 항목 추가·삭제 / 매체 강조 / 액션 우선순위 변경 / 발송 보류 / **[NEW v0.4] hallucination 사고 정정 발송: `--force-resend=true` 절차**)
  - artifact 사용법 + payload_hash 의미
  - 발송 절차 (검토 → confirm → 사후 5분 alert 확인)
  - rollback 매뉴얼 (광고주 opt-out 절차)
  - **[v1.3] 정정 발송 절차**: AE가 보낸 메일 발견 후 hallucination·오타 발견 시 (a) AE가 광고주에 정정 안내 메일 직접 작성·발송 (메일 클라이언트), (b) MCP에서 새 `prepare_weekly_dashboard(..., revisions=...)` 호출 → 새 EML draft export, (c) history JSONL에 `status=corrected` 새 entry append. force-resend flag 불필요 (서버 발송 아님).
- **매뉴얼 검증 acceptance**: AE 1명이 매뉴얼만 보고 1광고주 발송 성공 (전화·도움 0회)

---

## Risk & Mitigation (v0.3 강화)

| Risk                                                           | 영향                            | Mitigation                                                                                                                                                                                                                              |
| -------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI 환각                                                        | 광고주 신뢰 손상                | 시스템 프롬프트 사전계산 인용 강제 + 출력 검증 95%(1차)→99%(P4) + confidence < 0.7 경고 + AE 강제 검토                                                                                                                                  |
| 엑셀 변형                                                      | 파싱 실패                       | 3단계 파싱 + data_warnings + AE artifact 인지                                                                                                                                                                                           |
| MCP 단일 장애점                                                | 운영 중단                       | stdio 모델 → 서버 outage 영향 없음                                                                                                                                                                                                      |
| Anthropic rate/cost                                            | 운영비 가시성                   | prompt caching cache hit ≥ 80% + 비용 급증 Slack 알림(visibility, 차단 없음) + 운영자 판단 emergency disable flag                                                                                                                       |
| AE 머신 분실                                                   | PII/키 유출                     | Phase 4 runbook + 1Password 백업 + 자격증명 회전 절차                                                                                                                                                                                   |
| Live artifact 데이터 유출                                      | 광고주 데이터 외부              | 외부 fetch 0 + clipboard 명시적 클릭만 (OS 클립보드 보안 한계 명시)                                                                                                                                                                     |
| 0.7 confidence FP                                              | AE 피로                         | Phase 4 tuning: AE 피드백 5점 척도, 만족도 < 4/5 시 threshold 재산정                                                                                                                                                                    |
| Email 발송 실패                                                | 광고주 미수신                   | bounce 구독 + 5분 재확인 + Slack 알림 + history `status=failed`                                                                                                                                                                         |
| Artifact payload budget                                        | 렌더 실패                       | Phase 0 PoC 측정 + resource fallback                                                                                                                                                                                                    |
| Tool surface 비대                                              | 토큰 비용                       | read-only는 resource (총 5T/4R)                                                                                                                                                                                                         |
| Anthropic 키 오염                                              | 보안 사고                       | `.env` + `enumerable:false`                                                                                                                                                                                                             |
| Concurrency 이중 발송                                          | 광고주 이중 수신                | (client, week) lock + 발송 1회 정책 + force-resend 명시 flag                                                                                                                                                                            |
| history JSONL 손상                                             | 감사 누락                       | atomic write (temp+rename) + lock 획득 후                                                                                                                                                                                               |
| OS clipboard 누출                                              | 광고주 데이터 다른 앱 노출      | AE 교육: clipboard 30초 후 자동 비우기 OS 설정 권장                                                                                                                                                                                     |
| **[NEW v1.1] 광고주 데이터 외부 LLM 전송 (Anthropic)**         | 계약·법적 책임                  | 광고주 NDA 허용 확인됨(v1.1). 단 (a) prompt에 들어가는 PII 최소화(수신자 이메일은 SHA256 hash, 회사명·KPI 절대값만 전송), (b) 개인정보위 2025 생성형 AI 안내서 점검 1회(Phase 0), (c) 2026년 광고주 계약 갱신 시 AI 사용 조항 명시 권장 |
| **[NEW v1.1] 택스아이 등 데이터 비완전 광고주 누락 고지 부재** | 광고주 신뢰 손상·허위 표시 risk | Phase 0 PoC에 누락 고지 정책 결정 (artifact 상단 "❗ Naver API 미지원 영역(브랜드검색 영역별·파워컨텐츠 일부)은 본 리포트에서 제외됨" 배지) + Phase 2 dashboard/artifact-html에 구현                                                    |
| **[NEW v1.1] Claude Max seat 사용량 한도 초과**                | 월요일 피크에 prepare/send 차단 | Phase 0 PoC #3에서 Max plan 주간 sessions/messages cap 측정 + 한도 근접 시 Slack 알림. 초과 시 AE 분산 호출(월요일 → 화/수 분배) 또는 Anthropic API 직접(API 키, plan 외) 이중 채널 검토                                                |

---

## Acceptance Criteria (testable, v0.3)

| #   | 기준                                                                                                             | 측정                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | `npm test` 209 → **259+ passing**                                                                                | CI gate. Phase별 분배: P1 14+, P2 22+, P3 14+, P3.5 8+ = 58+, 기존 209 + 58 = 267 (목표 259+ 충족)   |
| 2   | 6 광고주 fixture 파싱 100%                                                                                       | CI gate (anonymized fixture only)                                                                    |
| 3   | artifact 정상 렌더 객관 기준                                                                                     | snapshot test: DOM 노드 ≥ 100, 콘솔 에러 0, 6 KPI 카드 + 매체 + insights ≥ 3 + actions ≥ 3 모두 존재 |
| 4   | Hallucination guard                                                                                              | review_text 숫자 ⊂ payload 사전계산 필드 ≥ **95%** (1차 ship), Phase 4 99%                           |
| 5   | 1명 테스트 발송 + history append                                                                                 | qa inbox 수신 확인 + JSONL 검증                                                                      |
| 6   | AE 만족도 평균 ≥ 4/5                                                                                             | 익명 설문 표본 ≥ 2명, 8 항목 (정확성/유용성/톤/속도/UX/문서/오류대응/추천)                           |
| 7   | confidence < 0.7 시 경고                                                                                         | snapshot test (artifact 상단 배지 visible)                                                           |
| 8   | grep 회귀 자격증명 0건                                                                                           | CI script (자동)                                                                                     |
| 9   | EML 파일 빌더 검증 (Mail.app/Outlook/Gmail import)                                                               | RFC 5322 syntax 검증 + 첨부 정상 + UTF-8 보존 (수동 검증)                                            |
| 10  | layer-rules + ESLint zone                                                                                        | `npm run lint` 0 violations                                                                          |
| 11  | Phase 4 runbook merge + cross-link                                                                               | SECURITY.md ↔ plan 양방향 링크                                                                       |
| 12  | **데일리 (Phase 3.5)** 응답 ≤ 60초 + 임계값 검출 100% + Slack 발송                                               | 자동 + 수동                                                                                          |
| 13  | **매뉴얼 검증** AE 1명 매뉴얼만으로 1광고주 발송 성공                                                            | Phase 4 수동                                                                                         |
| 14  | **Concurrency 테스트** 동시 prepare/send race + atomic JSONL                                                     | 자동 (Phase 1·3)                                                                                     |
| 15  | **Cost visibility 알림 동작** (전월 평균 ×2 초과 시 Slack)                                                       | Phase 3 alert 검증 (한도·결재 없음)                                                                  |
| 16  | **[NEW v0.4] Phase 0 acceptance**: resource 등록 (`naver-ads://client-mappings`, `naver-ads://history/{client}`) | `mcp.list_resources()`로 노출 확인 (자동 unit test)                                                  |
| 17  | **[NEW v0.4] Phase 0 acceptance**: client-mappings.json 스키마 검증 + 6 광고주 매핑 정합성                       | JSON schema validator (zod or ajv) unit test                                                         |
| 18  | **[NEW v0.4] Phase 0 acceptance**: Anthropic API ping 성공 (auth + 1 token round-trip)                           | dry-run script                                                                                       |
| 19  | **[NEW v0.4] Phase 0 acceptance**: history JSONL 스키마 결정성 (SHA256 PII hashing 동일 입력 → 동일 hash)        | unit test                                                                                            |

---

## Verification Steps (v0.3)

| #   | 단계                                                                                                               | 도구                              |
| --- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| 0   | **Dry-run mode**: `NAVER_ADS_DRY_RUN=1` env로 자격증명 없이 fixture 기반 호출                                      | mock 검증                         |
| 1   | `npm test`                                                                                                         | vitest                            |
| 2   | `npm run typecheck`                                                                                                | tsc 0 errors                      |
| 3   | `npm run lint` (zone)                                                                                              | ESLint 0 violations               |
| 4   | `time npm run build && time node dist/index.js --version`                                                          | 부팅 ≤ 2s                         |
| 5   | `prepare_weekly_dashboard --client=bishef --week=2026-W18 --dry-run` (fixture)                                     | artifact 렌더 ≤ 30s + DOM 검증    |
| 6   | 자연어 revisions 재호출                                                                                            | 새 hash + artifact diff           |
| 7   | `export_email_draft --payload_hash=...` → `~/.naver-ads-mcp/drafts/` 확인 + Mail.app 더블클릭 → qa inbox 수동 발송 | EML 정상 표시 + 첨부 + 발송       |
| 8   | `cat ~/.naver-ads-mcp/history/bishef/2026-W18.jsonl`                                                               | 1 line append + PII 최소화        |
| 9   | `npm run check:hallucination` (CI script)                                                                          | review_text 숫자 ⊂ 사전계산 ≥ 95% |
| 10  | `grep -rE "(secretKey\|accessLicense\|sk-ant-)" ~/.naver-ads-mcp/ logs/`                                           | 0건                               |
| 11  | Concurrency: 2 터미널 동시 send → 1건 통과, 1건 lock 거절                                                          | 수동                              |
| 12  | EML 파일을 Mail.app/Outlook/Gmail에 import → 정상 표시·발송 가능                                                   | 수동 검증 (Phase 3 산출물)        |
| 13  | Slack `#hellomax-mcp-alerts`에 dummy event 발송                                                                    | webhook OK                        |

---

## Migration Path (A → B 트리거)

다음 중 **2개 이상** 충족 시 Option B 풀스택 SaaS 전환 검토:

**규모 트리거**:

- 광고주 수 12+
- 동시 편집 AE 3명+

**기능 트리거**:

- 광고주 자체 history 조회 요구
- 발송 후 클릭/오픈율 추적 요구

**품질 트리거** (NEW):

- 6 광고주에서 hallucination 사고 1건 이상 발생
- AE 만족도 평균 < 4/5 (Phase 4 또는 후속 측정)
- 발송 실패율 > 2%

전환 시 모듈 재사용:

- parser/analyzer 모듈 → Next.js API route
- artifact-html → React 컴포넌트
- `naver-ads://history/{client}` URI는 안정 유지, backend Postgres swap
- `.env` Anthropic 키 → AWS Secrets Manager
- accounts.json → Postgres credentials

---

## ADR (Final, ralplan 합의 + Codex adversarial + v1.3 사용자 결정)

**Decision**: Option A — Live Artifact **preview only** + EML export + `naver-ads-mcp` 확장 (tool +2 / resource +2 → 5T/4R). **`prepare_weekly_dashboard` + `export_email_draft`** (v1.2 send_report_email 폐기).

**Drivers**:

1. Time-to-value — **약 8주 (1인 개발)** 파일럿 ship (v2.0 풀 SaaS 14주 대비 6주 단축)
2. AE workflow fit — Claude Desktop 사용 중, 자연어 편집 default + EML은 익숙한 Mail.app/Gmail로
3. Data integrity — 0 hallucination (1차 ship 95%, Phase 4 99%) + 외부 LLM 전송 risk 약화 (서버 자동 발송 0)

**Alternatives considered**:

- **B (풀스택 SaaS, v2.0 docs)**: 14주 + 인프라 ROI 미일치. §Migration Path로 보존.
- **C (Hybrid MCP + 경량 Web)**: 1인 capacity 초과. Option A의 fallback이 thin slice C 흡수.
- **A v1.2 (artifact + SES 자동 발송)**: artifact↔MCP 콜백 가정 미검증·SES 도메인 인증 부담·서버 자동 발송 risk → v1.3에서 폐기

**Why chosen**:

- 사용자 명시 제약("광고주별 대시보드는 Claude Live Artifact") 직접 충족 (preview로 충족)
- 1인 개발 capacity에서 운영 복잡도 최소 (SES·DKIM/SPF·도메인 인증·bounce 처리 모두 0)
- Codex 최대 risk(외부 LLM 전송) 더 약화: 광고주에게 보내는 메일 자체는 AE 메일 클라이언트가 처리 → 서버 분실·자동 발송 사고 risk 0
- B/C로의 마이그레이션 경로를 모듈 경계로 보존
- 비용은 visibility 알림만 (한도·결재 게이트 없음, v1.2 결정)

**Consequences**:

- ⊕ 약 8주 ship (1인 개발, 직렬), 슬리피지 시 데일리 v2 후퇴로 6주 v1.0 가능
- ⊕ 인프라 0 (stdio MCP + file lock + JSONL audit, SES/SMTP 전부 제거)
- ⊕ MCP 단일 도구로 AE 전환 비용 0
- ⊕ Codex 최대 risk(외부 LLM 전송) 더 약화 — 발송은 AE 메일 클라이언트
- ⊕ 광고주 메일 from·reply-to가 AE 본인 주소 → 광고주가 자연스러운 회신 가능
- ⊖ EML 파일 → AE가 메일 클라이언트로 1단계 더 거침 (자동 발송 안 함)
- ⊖ 1회용 artifact (영속 UI 없음) — 광고주 자체 history 요구 시 Migration 트리거
- ⊖ AE 머신이 단일 보안 경계 → Phase 4 runbook 의무화
- ⊖ 클릭/오픈율 추적 불가 (SES 없음) — Migration 트리거

**Follow-ups**:

- Phase 5 (신규 광고주 온보딩 자동화) — v2 분리, out-of-scope
- §Migration Path 트리거 정기 점검 (월 1회 운영 회고)
- AE 만족도 < 4/5 또는 hallucination 사고 1건 이상 발생 시 즉시 §Migration Path 검토
- 발송 후 클릭/오픈율 추적 요구 발생 시 SES open-tracking 도입 + backend Postgres 마이그레이션 검토 (v1.3에서 SES 의존 제거됐으므로 별도 추가)
- Phase 4 종료 후 prompt cache hit rate 실측 → 비용 추정 갱신 (월 1회 운영 회고에서 검토)

---

## Resolved Questions (v0.4 처리 상태)

| #      | 질문                                                              | v0.4 처리                                                       | 분류                        |
| ------ | ----------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------- |
| 1      | JSON copy 라운드트립 UX                                           | 자연어 편집 default (Phase 0 PoC로 검증)                        | **결정**                    |
| 2      | artifact 페이로드 한계                                            | Phase 0 PoC 측정 + resource fallback                            | **deferred to Phase 0 PoC** |
| 3      | email 채널 default                                                | **EML 파일 export only** (AE 메일 클라이언트로 직접 발송, v1.3) | **결정** (SES 폐기, v1.3)   |
| 4      | confidence threshold 0.7                                          | Phase 4 tuning (AE 만족도 < 4/5 시 재산정)                      | **deferred to Phase 4**     |
| 5      | history 영속 위치                                                 | `naver-ads://history/{client}` resource 추상화                  | **결정**                    |
| 6      | hallucination 임계값                                              | 95% (1차 ship), 99% (Phase 4)                                   | **결정**                    |
| 7      | Slack workspace                                                   | ZBROS, `#hellomax-mcp-alerts` + `#hellomax-mcp-sends`           | **결정**                    |
| 8      | runbook 검증자                                                    | ZBROS 내부 보안 1인 + AE 1인                                    | **결정**                    |
| 9      | 데일리 임계값 정의                                                | Phase 0 PoC 합의 (ROAS -20% MoM 등 후보)                        | **deferred to Phase 0 PoC** |
| 10     | B Migration 트리거                                                | 규모/기능/품질 3축 8개 트리거                                   | **결정**                    |
| 11     | Principle 3 표현                                                  | "Evidenced runs, stateless artifact"로 정정                     | **결정**                    |
| **12** | ~~ZBROS USD 결재 라인~~ (v1.2 폐기)                               | **사용자 결정: 결제 한도/결재 게이트 제거** (v1.2)              | **결정** (제거)             |
| **13** | **[NEW v1.1] Codex Q1**: 광고주 NDA에 AI 분석·외부 API 전송 허용? | **사용자 확인: 허용**                                           | **결정**                    |
| **14** | **[NEW v1.1] Codex Q2**: 운영 Claude seat                         | **Claude Max**                                                  | **결정**                    |

**요약**: 14건 중 결정 10건 + deferred 4건 (Q2/Q4/Q9/Q12).

## Open Questions (v1.3에서 모두 해소)

v1.3 결정으로 v1.2 미해소 3건 모두 처리:

| #   | v1.2 질문                                         | v1.3 결정                                                                                                                            |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| O1  | 택스아이 누락 고지 정책                           | **단순 데이터 표기** — artifact 셀 "Naver 미제공" + 합계 표시. 별도 안내 메일·footer 절차 없음 (Naver API 한계는 광고주가 이미 인지) |
| O2  | Dev 인원 / 일정                                   | **1인** → Phase 3 단순화 + 직렬 강제로 약 8주. 슬리피지 발생 시 데일리(P3.5) v2 후퇴로 6주에 v1.0 ship 가능                          |
| O3  | Claude Max 한도                                   | Phase 0 PoC #3 측정 후 결정 (deferred). 초과 시 분산 호출 또는 API 키 이중 채널                                                      |
| —   | Codex 제안 "artifact preview only + markdown/EML" | **채택**. send_report_email tool 폐기, export_email_draft로 단순화. SES/도메인 인증 의존 0                                           |

### v1.3 deferred (Phase 0 PoC에서 확정)

(없음 — 모든 v1.2 미해소 또는 v1.3 신규 결정 항목 처리됨)

### 이전 v1.2 Open Questions (참고용)

| #   | 질문                                                                                                                                             | 출처                 | 답변 게이트                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- | --------------------------------------------- |
| O1  | **택스아이 등 데이터 비완전 광고주(Naver brand search 영역별 미지원) 누락 고지·수동 보완 절차**                                                  | Codex Q3             | Phase 0 산출물 + Phase 2 artifact 디자인 반영 |
| O2  | **Dev 인원 명시** — 8.5주 일정은 인원 가정에 민감. 1인이면 9주+ fallback 또는 scope 축소                                                         | Codex 일정 challenge | plan-approval 시점                            |
| O3  | **Claude Max seat 운영 가정** — 월 156회+재호출+첨부 모델 호출이 월요일 피크에 Max plan 사용량 한도(주간 sessions/messages cap) 안에 들어가는가? | Codex Q2 후속        | Phase 0 PoC #3 (cost visibility 추정에 통합)  |
