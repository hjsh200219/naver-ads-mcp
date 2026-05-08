---
name: ralplan-codex-consensus-pattern
description: ralplan 4 라운드(Architect→Critic×2→APPROVE) + Codex adversarial 리뷰 패턴 — 같은 LLM 패밀리 합의의 blind spot을 외부 모델로 challenge
type: feedback
created: 2026-05-08
---

본 프로젝트에서 큰 plan/architecture 결정 시 적용한 합의 패턴.

**합의 흐름**:

1. Planner 초안 작성 (Claude Opus, 본 세션)
2. Architect 리뷰 (Claude general-purpose agent) — steelman antithesis + trade-off tension + synthesis 요구
3. Critic 1차 리뷰 (Claude general-purpose agent) — Principle/Option 일관성 + AC testability + 운영 갭
4. Planner v0.2/v0.3 수정
5. Critic 2차/3차 리뷰 — 이전 must-fix 흡수 검증 + 신규 모순 검출
6. Critic APPROVE 시 ADR 채우기
7. **외부 모델 adversarial 리뷰** — Codex(GPT-5.x)로 같은 패밀리 합의의 blind spot challenge

**Codex adversarial이 잡아낸 v1.0 LOCKED의 약점** (실제 사례):

- Live Artifact가 stdio MCP로 콜백 가능하다는 가정 미검증 (Anthropic 공식 도움말상 공식 브리지 확인 안 됨)
- 광고주 데이터 외부 LLM 전송에 대한 계약/법적 승인 부재 (최대 단일 risk)
- 택스아이 같은 데이터 비완전 광고주 누락 고지 정책 부재
- 8.5주 일정의 dev 인원 가정 부재
- 더 가벼운 대안 ("artifact preview only + markdown/EML") 충분히 비교 안 됨

**Why:** Claude 패밀리 안에서 4 라운드 합의는 일관성을 정교화하는 데 강점이지만 sycophancy/blind spot 위험이 있음. 외부 모델(Codex)이 잡아낸 5건 중 4건이 ralplan 4 라운드에서 한 번도 나오지 않았던 새 challenge였다. CONDITIONAL 판정 + 사용자 답변(Q1·Q2)으로 일부 해소 + Open Questions(O1·O2·O3)로 명시 deferred로 처리한 게 실용적.

**How to apply:** 다음 큰 plan 결정 시(예: Migration Path Option B 전환 결정, 신규 광고주 온보딩 자동화 v2 plan) 동일 패턴 적용. 특히 ralplan APPROVE 직후가 아니라 LOCKED 직전에 Codex adversarial 1회 받는 것이 가장 효과적이었음. Codex 호출은 `codex:rescue` 서브에이전트 사용. 출력 형식: 5 카테고리 critique + GO/NO-GO/CONDITIONAL verdict + ralplan이 missed한 핵심 질문 1-3개.
