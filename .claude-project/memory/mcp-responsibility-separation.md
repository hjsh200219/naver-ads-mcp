---
name: mcp-responsibility-separation
description: MCP는 자기 도메인에 집중하고 다른 도메인(이메일·캘린더 등)은 외부 MCP에 위임 — 표준 payload JSON으로 데이터 전달
type: project
created: 2026-05-09
---

naver-ads-mcp는 **Naver SearchAd + AI 분석 + Live Artifact preview + email_payload 생성**에만 집중. 이메일 발송 자체는 외부 MCP(Gmail MCP 등)가 담당.

**왜 이 경계가 중요한가**:

- 이메일 인프라(SES/SMTP/nodemailer/도메인 인증/DKIM·SPF/sandbox/bounce 처리/sent items audit)는 이미 다른 MCP가 해결한 도메인. 재구현은 중복 + 책임 비대화 + 1인 capacity 초과.
- naver-ads-mcp가 Naver API HMAC + 광고주 자격증명 + Anthropic API + 6 광고주 데이터까지 들고 있는데 SMTP까지 추가하면 단일 보안 경계가 너무 비대해짐.
- 외부 Email MCP가 outage·deprecation돼도 naver-ads-mcp는 prepare까지는 정상 — 부분 가용성 보존.

**적용 패턴 (v1.5 채택)**:

- naver-ads-mcp `prepare_weekly_dashboard` 반환에 `email_payload: { to, cc[], subject, html_body, attachment_path }` 표준 JSON 포함
- AE가 Claude Desktop에서 "발송해" → Claude가 Gmail MCP `create_draft`/send에 그 payload 전달
- naver-ads-mcp `history/{client}` JSONL은 prepare 이벤트만 기록 (`status=prepared`)
- send 이벤트는 외부 Email MCP의 sent items가 source of truth — naver-ads-mcp에서 추적 시도 금지

**금지된 흔적** (v1.4 → v1.5에서 제거):

- ❌ `send_report_email` tool
- ❌ `src/runtime/email-send.ts`
- ❌ accounts.json `smtp` 자격증명 키
- ❌ nodemailer / AWS SES / DKIM·SPF 검증 / bounce subscribe
- ❌ "발송 후 5분 status 재확인" 류 자동화

**Why:** 1인 개발 capacity에서 정직한 책임 경계. 4 라운드 진화(v1.2 결제 게이트 제거 → v1.3 artifact preview only → v1.4 SMTP 부활 → v1.5 외부 MCP 위임)에서 v1.4의 SMTP 부활이 잘못된 방향이었음을 사용자가 즉시 정정해 v1.5 도달. 이 패턴은 다른 도메인(예: 캘린더 자동화 → Google Calendar MCP에 위임, Slack 자동화 → Slack MCP 위임)에도 동일 적용.

**How to apply:**

1. 새 MCP tool 추가 시 "이건 우리 도메인인가, 다른 MCP가 이미 해결했나?" 첫 질문
2. "이미 해결됐다"면 표준 payload JSON 형식만 정의하고 그 MCP에 위임
3. payload는 외부 MCP가 그대로 소비할 수 있는 표준 구조 (Gmail/SMTP 표준 필드명 — `to`, `cc`, `subject`, `html_body`, `attachment_path`)
4. history/audit은 우리 도메인 이벤트(prepare)만 기록. 다른 MCP의 이벤트는 그쪽이 source of truth
5. layer-rules + ESLint zone에 외부 도메인 관련 의존성(`nodemailer`, `aws-sdk` 등) 추가 금지 명시
