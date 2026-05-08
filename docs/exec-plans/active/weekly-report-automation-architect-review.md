# Architect Review — helloMAX Weekly Report Automation (Planner Draft v0.1)

> 리뷰어: Architect (consensus workflow)
> 날짜: 2026-05-08
> 대상: `weekly-report-automation-draft.md` v0.1
> 판정: **ITERATE** (구조는 건전하나 4개 차단 이슈 수정 후 Critic 진행)

---

## 1. Steelman Antithesis — "Live Artifact를 빼고, MCP가 즉시 발송하라"

가장 강한 반대 입장은 **Option A의 핵심인 "live artifact를 편집 UI로 사용"을 통째로 부정**하는 것이다. 핵심 논거 4가지:

1. **Artifact는 UI가 아니라 view다.** Claude artifact는 (a) 새 대화/세션이 시작되면 사라지는 **stateless 렌더 결과물**이고, (b) artifact 안의 JS가 호스트로 콜백할 공식 채널은 없다. AE가 편집한 내용을 MCP로 되돌리는 유일한 길이 "JSON 복사 → 채팅 붙여넣기"라면, 이는 UI가 아니라 **카피-페이스트 기반 워크플로우**이며, AE 5명이 매주 6회 반복하면 친화적이지 않다.
2. **편집은 AE의 한국어 메시지로 충분하다.** "ROAS 톤만 살짝 부드럽게 + 액션 3번 빼줘" 같은 자연어 수정 요청을 Claude가 다시 MCP에 전달해 재생성·발송하는 것이, JSON 클립보드 라운드트립보다 **AE 인지부담이 낮다**. 이 경우 artifact는 단순 미리보기로 격하되고, 편집 권한은 LLM 대화창이 가진다.
3. **Artifact 페이로드 한계는 실측 안 된 가정이다.** 비셰프 샘플 HTML이 965 라인 + 인라인 JS다. 여기에 6 KPI × 4 매체 × N 키워드 + insights/actions JSON을 인젝션하면 Claude Sonnet 4.6의 토큰/렌더 budget을 어디까지 쓰는지 플랜은 답하지 않았다. 실패하면 "artifact 끊김" → AE가 즉시 워크플로우 신뢰를 잃는다.
4. **단일 send tool + 자연어 컨펌 = MCP-first 원칙에 더 충실하다.** "MCP-first, stateless, evidenced"라는 Principle 1·3과 가장 잘 맞는 설계는 오히려 _artifact 없이_ `prepare_weekly_dashboard` → 결과 표시 → AE "발송해" → `send_report_email` 흐름이다. artifact는 광고주에게 보낼 **이메일 본문 미리보기 전용**으로만 쓴다.

이 antithesis는 사용자가 명시한 "live artifact 사용" 제약과 충돌하지만, **그 제약 자체를 검증하지 않은 채 설계에 박은 것**이 본 플랜의 약점이다.

---

## 2. Trade-off Tension — "0 인프라" vs "MCP 클라우드 배포 가능성"

플랜은 **인프라 0**(no DB, no SES, no S3)을 Pros 1순위로 내세우면서도, history를 `~/.naver-ads-mcp/history/{client}/{week}.json`로 **AE 머신 로컬**에 영속화한다. 동시에 `email/send.ts`는 SMTP/SES를 AE 머신에서 호출한다. 트레이드오프는:

- **얻는 것**: 운영 부담 0, 8주 ship 가능, "stateless artifact + evidenced run" 슬로건과 일치.
- **잃는 것**:
  - AE PC가 꺼지면 월요일 발송 불가 (가용성 낮음).
  - AE PC = 광고주 PII + 발송 자격증명 + history 보관소 → **단일 머신이 보안 경계**가 됨. 노트북 분실 = 6 광고주 데이터 유출 + Gmail/SES 키 유출.
  - history JSON 백업/공유 메커니즘 부재 → AE 교체 시 인계 누락.
  - Open Question 5에서 "MCP 서버 클라우드 배포 시 변경 필요"라고 본인이 _이미_ 인정함 → 이 트레이드오프가 미해결인 채로 phase에 진입.

**판정**: 8주 파일럿 한정에서는 정당한 트레이드오프. 단 phase 4 acceptance에 **"history 백업 정책 + 머신 분실 시 키 회전 runbook"** 산출물을 추가해야 한다. 이게 빠지면 SECURITY.md "자격증명 노출 0건" 회귀 테스트로 잡히지 않는 운영 risk가 남는다.

---

## 3. Synthesis — Option A를 유지하면서 antithesis 흡수

세 가지 작은 수정으로 antithesis의 강한 부분을 흡수할 수 있다:

**S1. Artifact를 "편집 UI"가 아닌 "프리뷰 + 자연어 편집 트리거"로 재정의.**

- artifact 안의 textarea는 **로컬 시각화용**이고, 실제 편집 경로는 AE가 Claude 대화창에 한국어로 지시 → MCP가 `prepare_weekly_dashboard(..., revisions=[...])` 재호출 → 새 artifact 렌더.
- "JSON 복사 → 붙여넣기"는 **opt-in fallback**(AE가 정밀 수정 원할 때만)이며 default 경로가 아님.
- send tool은 마지막 artifact의 `payload_hash`(MCP가 발급)를 받아 검증 → 무수정 발송 시 클립보드 라운드트립 0회.

**S2. Live Artifact 페이로드 budget을 Phase 0에서 실측.**

- 비셰프 샘플 + 실 KPI 인젝션 → 토큰 수, 렌더 시간 측정 → Phase 1 진입 게이트로 추가.
- 한계 초과 시 KPI/insights/actions를 **MCP resource(`naver-ads://weekly/{client}/{week}`)**로 분리하고 artifact는 fetch 없이 인라인 JSON만 받도록 다이어트.

**S3. History를 로컬 파일이 아닌 MCP resource로 노출.**

- `naver-ads://history/{client}` resource → 파일은 여전히 로컬 JSONL이지만 AE가 list\_\*을 부르지 않고 resource read로 접근.
- 향후 cloud 이행 시 resource URI는 안정 유지, 백엔드만 Postgres로 바꾸면 됨 → Open Question 5 자동 해소.

이 세 가지는 모두 **Option A의 큰 그림(MCP 확장 + artifact UI)**을 깨지 않으며, MCP-first/L1~L5/8주 ship과 양립한다.

---

## 4. Specific Issues / Gaps (Planner가 놓치거나 틀린 것)

### 4.1 [차단] Live artifact ↔ MCP 콜백 경로 미검증

- 플랜은 "AE가 JSON 복사 → 붙여넣기"를 default flow로 가정한다. 그러나 artifact 내 JS는 `navigator.clipboard.writeText`까지는 가능해도 **MCP tool을 직접 호출할 수단이 없다.** Anthropic Claude artifact 런타임은 host로의 양방향 RPC를 공식 노출하지 않는다.
- Open Question 1에서 "artifact의 export가 MCP로 직접 POST(local HTTP)"를 대안으로 던졌는데, 이는 **AE 머신에 로컬 HTTP 서버 띄우기** = stdio MCP 모델과 충돌하고 보안 표면 증가.
- **요구 조치**: Phase 0에 "artifact ↔ MCP 통신 PoC"를 추가하라. 옵션은 (a) clipboard + 채팅 붙여넣기 UX, (b) MCP가 발급한 short-lived token + 자연어 confirm. 하나 검증된 후 Phase 1 시작.

### 4.2 [차단] 새 tool 3개 추가가 token-saving 정책과 충돌

- AGENTS.md L1 항: 현재 MCP surface는 **3 tools + 2 resources**로 균형을 잡았다. 플랜은 tool 3개 추가 → **6 tools**로 두 배. 최근 list\_\* → resources 이행과 정면 충돌.
- 권장 재맵핑:
  - `prepare_weekly_dashboard` → **tool 유지**(write/compute action이라 정당).
  - `send_report_email` → **tool 유지**(부수효과 확정).
  - `upload_excel_for_parse` → **resource로 변환 불가**(client가 파일 path를 push). 그러나 광고주 매핑/예시는 `naver-ads://client-mappings`, `naver-ads://weekly-history/{client}` resource로 보강.
- **요구 조치**: tool 추가 사유와 resource로 가능한 부분(history list, mapping list, sample HTML 등)을 plan에 명시 분리.

### 4.3 [차단] L2 모듈 5개 신설이 layer-rules.md와 일부 충돌

- 플랜의 L2 신설: `parser/`, `analyzer/`, `dashboard/`, `email/`, `history/`. layer-rules.md는 L2를 `raw/pivot/excel/util/`로 명시 + ESLint `import/no-restricted-paths`로 강제.
- `analyzer/ai-comment.ts`가 L3에 새 API(Anthropic)를 호출하려면 **L3에 `src/api/anthropic.ts` 신설 + L2 analyzer가 그것을 import**해야 한다. 플랜은 L3 칸에 "Anthropic API [NEW]"라고만 적었지 module 위치/이름이 모호.
- `dashboard/artifact-html.ts`는 HTML 문자열 빌더 = `excel/`과 동급의 L2 sink → OK. 단 `raw/builder.ts` 타입과 신규 KPI 타입 의존만 허용.
- `history/log.ts`가 `node:fs`를 직접 쓴다면 **L1 runtime helper**(`src/runtime/`)에 두는 게 layer-rules와 일치. L2에 두면 file IO가 L2로 새는 첫 사례가 된다.
- **요구 조치**: 신설 모듈 5개를 L1/L2/L3로 명시 라벨링 + ESLint zone 갱신을 Phase 0 산출물로 박아라.

### 4.4 [차단] Hallucination guard 정규식이 실제로 막지 못한다

- 플랜: "review_text의 숫자가 입력 KPI에 존재하는지 정규식 체크".
- 반례:
  - `"ROAS가 전주 대비 12% 상승"` → 12라는 숫자가 raw KPI(예: ROAS 4.7)에는 없지만 **계산된 증감률**이라 문맥상 맞을 수 있다.
  - `"광고비 480만 원"` vs raw `4_800_000` → 단위 변환(만/원) 매칭 실패.
  - `"전환 12건 증가"` 같은 **델타 표현**.
- **요구 조치**: guard를 두 단계로:
  - (a) 단순 raw KPI 매칭(절대값) → fail시 confidence 0.3 패널티.
  - (b) 증감률/단위 변환은 **MCP가 사전 계산해 KPI payload에 포함**(Principle 2 "AI는 계산 금지"와 일치) → AI는 이 사전계산 값만 인용하도록 system prompt 강제.
  - 두 단계 모두 통과 못하면 confidence < 0.7 게이트 발동.

### 4.5 [경고] Anthropic API key 저장 위치

- 플랜: "`accounts.json`에 `anthropic` 키 추가, 기존 패턴 재활용".
- `accounts.json`은 **광고주별 Naver 자격증명 레지스트리**다. Anthropic 키는 광고주 단위가 아니라 **MCP 서버 단위 단일 키**.
- 권장: `.env` `ANTHROPIC_API_KEY` + `enumerable: false`로 `credentials.ts`에 노출. accounts.json 스키마를 광고주 외 시크릿으로 오염시키지 말 것.

### 4.6 [경고] Phase 길이 합산 8주 + 30+ 신규 테스트

- 0.5 + 1.5 + 2.5 + 2 + 1.5 = 8주. 그러나 Phase 4가 "AE 2~3명 × 2주간 6광고주 모두" — 1.5주 안에 못 들어간다. **Phase 4 = 2주가 현실적**, 총 8.5주.
- 209 tests → 240+ (30+ 신규). parser 6 광고주 × 다양한 셀 케이스만 해도 12+, analyzer 프롬프트 회귀 8+, dashboard HTML snapshot 6+, email/history 8+, MCP integration 6+. **실측 50+ 가까울 것** → acceptance #1 기준을 245+로 올리거나, 테스트 우선순위를 Phase별로 명시.

### 4.7 [경고] Email 발송 채널 선택 미결

- Open Question 3은 plan 합의 _전에_ 결정해야 한다. Gmail SMTP는 (a) AE 개인 OAuth 또는 app password, (b) "from"이 AE 개인 주소 → 광고주 입장에서 정식 hellomax 도메인 메일이 아님 → 신뢰도 손상. SES는 도메인 인증 + DKIM/SPF 필요 → "인프라 0" 원칙 위배.
- **요구 조치**: Phase 0 산출물에 **"hellomax.co.kr 도메인 메일 발송 가능 채널"** 결정. SES 도입 비용을 인프라 risk로 명시하거나, **외부 메일 발송을 v2로 후퇴**(v1은 AE가 보낼 수 있게 미리보기 + 발송 가능한 EML 파일 생성)을 진지하게 고려.

### 4.8 [정보] Acceptance #4 측정 가능성

- "review_text 내 숫자가 입력 KPI에 모두 존재" — 실패 시 자동 Phase 진행 차단되도록 CI에 강제 게이트 추가 명시. 현재는 "정규식 + 자동 검증"으로만 적혀 있어 누가 언제 돌리는지 불명.

---

## 5. Verdict

**ITERATE** — 구조의 큰 그림(Option A, 8주 파일럿, MCP 확장)은 옳다. 인프라 0 베팅도 6 광고주 규모에서는 정당하다. 그러나 **차단 4건**(§4.1~4.4)은 Phase 1 진입 전에 반드시 해소되어야 한다.

### Critic으로 넘기기 전 MUST-FIX

1. Phase 0에 **artifact ↔ MCP 통신 PoC + 페이로드 budget 측정** 추가.
2. 신설 5 L2 모듈을 layer-rules에 맞춰 **L1/L2/L3 라벨링 + ESLint zone 명시**.
3. Hallucination guard를 **사전 계산된 KPI 인용 강제**로 강화.
4. Tool 3개 추가 사유 + **resource로 가능한 부분 분리** 명시.
5. Anthropic 키는 `.env` + `enumerable: false`. accounts.json 오염 금지.
6. Email 채널(Gmail vs SES vs EML export)을 plan 합의 전 결정.

### SHOULD-FIX

7. Phase 4를 2주로 늘려 총 **8.5주**, 또는 AE 인원/광고주 수 축소.
8. Acceptance #1 테스트 수 기준 245+ 또는 phase별 테스트 분배 표 추가.
9. History 백업 정책 + 머신 분실 시 키 회전 runbook을 Phase 4 산출물에 추가.

위 9개를 반영한 v0.2 draft를 만든 뒤 Critic이 품질 기준(testability, observability, runtime 안정성, AE UX 검증) 관점에서 최종 가드를 통과시키게 해야 한다.
