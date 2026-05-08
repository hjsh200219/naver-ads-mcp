---
name: weekly-report-automation-plan
description: helloMAX 주간/데일리 리포트 자동화 + 광고주별 Live Artifact 대시보드 합의 플랜 v1.1 LOCKED — Phase 0 진입 게이트와 핵심 결정 요약
type: project
created: 2026-05-08
---

helloMAX 주간/데일리 광고 리포트 자동화 + 광고주별 Live Artifact 대시보드를 `naver-ads-mcp`에 확장 형태로 구현하는 합의 플랜이 **v1.4 FINAL** 상태로 산출됨. 산출물 위치: `docs/exec-plans/active/weekly-report-automation-plan.md` + 4 review + 1 codex review. v1.4 변경점: 이메일 전송은 **MCP가 직접 발송** (v1.3 EML export 폐기, v1.2 send_report_email 부활). 단 **추가 개발 0 정책**: SES/도메인 인증/DKIM/SPF 미도입, 간단 SMTP(nodemailer + accounts.json `smtp` 키)만 사용. artifact preview only는 v1.3에서 그대로 유지.

**핵심 결정** (Phase 0 진입 시 참조 필수, v1.4 FINAL):

- Decision: Option A — Live Artifact **preview only** + **MCP 직접 발송 (간단 SMTP)** + MCP 확장 (5 tools + 4 resources)
- Tool 추가: `prepare_weekly_dashboard`, **`send_report_email`** (v1.4, nodemailer 기반)
- Resource 추가: `naver-ads://client-mappings`, `naver-ads://history/{client}`
- 일정: **약 8.5주 (1인 개발, 직렬)** / 슬리피지 시 데일리 후퇴로 약 7주 v1.0 ship 가능
- 편집 default: AE 자연어 → MCP 재호출. JSON copy/paste opt-in
- 발송: MCP가 nodemailer + accounts.json `smtp` 키로 SMTP 직접 발송. **추가 개발 0 정책**: SES/도메인 인증/DKIM/SPF 미도입, 간단 SMTP 1개(Gmail app password / hellomax 자체 SMTP / SendGrid free 등)만 사용
- Hallucination guard: 95% (1차 ship), 99% (Phase 4)
- 보안 핵심: AE 머신이 단일 보안 경계 → Phase 4 runbook 의무화 + Anthropic·SMTP 키는 `accounts.json`/`.env` + `enumerable:false`

**Phase 1 GO 게이트** (모두 충족해야 진입; v1.2에서 결재·한도 게이트 제거):

1. Phase 0 PoC 4건: artifact↔MCP 콜백 capability 실측 / Claude Max seat 사용량 한도 측정 / 택스아이 누락 고지 정책 결정 / PII 최소화 prompt 설계
2. Phase 0 acceptance 4건 (resource 등록 / mappings schema / Anthropic ping / JSONL 결정성)
3. ~~ZBROS 월 USD 결재 라인 서면 합의~~ — v1.2에서 폐기 (사용자 결정: 결제 한도/결재 게이트 제거, 비용은 visibility 알림만 유지)

**미해소 Open Questions** (Phase 1 GO 전 답변 필요):

- O1: 택스아이 등 데이터 비완전 광고주 누락 고지 (artifact 배지만 / +이메일 footer / +별도 안내 메일)
- O2: Dev 인원 (1인 9-12주 fallback / 2인 8.5주 / 더 많음)
- O3: Claude Max 월요일 피크 분산 정책

**Why:** ralplan 4 라운드 + Codex adversarial 통과 후 v1.1 LOCKED. 다음 세션이 Phase 0/1로 진입할 때 게이트와 미해소 질문을 다시 추적하지 않고 본 메모로 즉시 컨텍스트 복원하기 위함.

**How to apply:** Phase 0 진입 결정·실행 시점에 본 메모와 plan 파일을 함께 참조. Phase 0 진입 전 O1/O2/O3 답변 확보 + ZBROS 결재 합의 확인. plan 진행 중 Migration 트리거(광고주 12+ / 다중 AE 3+ / hallucination 사고 1건+ / AE 만족도 < 4/5 / 발송 실패율 > 2%) 발생 시 §Migration Path로 Option B(풀스택 SaaS) 전환 검토.
