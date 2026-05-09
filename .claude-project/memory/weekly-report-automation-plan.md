---
name: weekly-report-automation-plan
description: helloMAX 주간/데일리 리포트 자동화 + 광고주별 Live Artifact 대시보드 합의 플랜 v1.5 FINAL — Phase 0 진입 게이트와 핵심 결정 요약
type: project
created: 2026-05-08
---

helloMAX 주간/데일리 광고 리포트 자동화 + 광고주별 Live Artifact 대시보드를 `naver-ads-mcp`에 확장 형태로 구현하는 합의 플랜이 **v1.5 FINAL** 상태로 산출됨. 산출물 위치: `docs/exec-plans/active/weekly-report-automation-plan.md` + 4 review + 1 codex review. v1.5 변경점: 이메일 발송은 naver-ads-mcp 책임 아님 — **별도 MCP**(Gmail MCP 등)에 위임. naver-ads-mcp는 `prepare_weekly_dashboard`가 artifact + email_payload(To/Cc/Subject/HTML body/첨부 path)만 반환. send_report_email tool 제거, nodemailer/SMTP 의존성 0. artifact preview only는 v1.3 유지.

**핵심 결정** (Phase 0 진입 시 참조 필수, v1.5 FINAL):

- Decision: Option A — Live Artifact **preview only** + **email_payload 생성 후 외부 Email MCP 위임** + MCP 확장 (4 tools + 4 resources)
- Tool 추가: **`prepare_weekly_dashboard`만** (v1.5, send tool 제거)
- Resource 추가: `naver-ads://client-mappings`, `naver-ads://history/{client}` (prepare 이력만)
- 일정: **약 8주 (1인 개발, 직렬)** / 슬리피지 시 데일리 후퇴로 약 7주 v1.0 ship 가능
- 편집 default: AE 자연어 → MCP 재호출. JSON copy/paste opt-in
- 발송: **외부 Email MCP** (Gmail MCP 등)가 담당. naver-ads-mcp는 `email_payload {to, cc[], subject, html_body, attachment_path}` 표준 JSON만 반환. nodemailer/SMTP/SES 의존성 0
- 책임 분리: naver-ads-mcp = 데이터·AI·preview·payload 생성 / 외부 MCP = 발송. send 이력은 외부 MCP의 sent items가 source of truth
- Hallucination guard: 95% (1차 ship), 99% (Phase 4)
- 보안 핵심: AE 머신이 단일 보안 경계 → Phase 4 runbook 의무화 + Anthropic 키는 `accounts.json`/`.env` + `enumerable:false`

**Phase 1 GO 게이트** (모두 충족해야 진입; v1.2에서 결재·한도 게이트 제거):

1. Phase 0 PoC: Live Artifact preview 렌더 + 자연어 수정 재호출 / 외부 Email MCP payload draft·send 검증 / Claude Max 사용량 측정 / PII 최소화 prompt 설계
2. Phase 0 acceptance: resource 등록 / client-mappings schema / Anthropic ping / history JSONL 결정성
3. Phase 0 구현 기반: layer-rules + ESLint zone / 6 광고주 mappings / anonymized fixtures / Naver+Anthropic CI mock
4. ~~ZBROS 월 USD 결재 라인 서면 합의~~ — v1.2에서 폐기. 비용은 전월 평균 ×2 초과 Slack visibility 알림만 유지

**Open Questions**:

- O1 택스아이 누락 고지: 해소 — artifact 셀 "Naver 미제공" + `data_warnings[]`, 별도 안내 메일·footer 없음
- O2 Dev 인원: 해소 — 1인 직렬, 약 8주. 슬리피지 시 데일리(P3.5) v2 후퇴
- O3 Claude Max 한도: Phase 0 PoC에서 실측 후 분산 호출 또는 Anthropic API 직접 채널 검토

**Why:** ralplan 4 라운드 + Codex adversarial 통과 후 사용자 결정(v1.2~v1.5)을 반영한 FINAL 플랜. 다음 세션이 Phase 0/1로 진입할 때 게이트와 책임 경계를 다시 추적하지 않고 본 메모로 즉시 컨텍스트 복원하기 위함.

**How to apply:** Phase 0 진입 결정·실행 시점에 본 메모와 active plan 파일을 함께 참조. naver-ads-mcp는 데이터·AI·preview·payload 생성까지만 담당하고, 발송은 외부 Email MCP에 위임한다. plan 진행 중 Migration 트리거(광고주 12+ / 다중 AE 3+ / hallucination 사고 1건+ / AE 만족도 < 4/5 / 발송 실패율 > 2%) 발생 시 §Migration Path로 Option B(풀스택 SaaS) 전환 검토.
