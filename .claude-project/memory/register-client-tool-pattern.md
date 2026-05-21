---
name: register-client-tool-pattern
description: register_client tool이 accounts.json(자격증명) ↔ client-mappings.json(보고서 메타) 사이를 연결
type: project
created: 2026-05-21
---

`accounts.json` = 자격증명 store (`customerId`, `accessLicense`, `secretKey`). `src/config/client-mappings.json` = 보고서 메타 store (`client_id`, `display_name`, `customer_id`, `recipients`, `cc`). 두 파일은 역할 다름 — accounts.json만으로는 weekly/daily report tool 작동 불가.

**register_client tool 흐름** (commit 42bce5b, src/mcp/server.ts):

1. `client_id` + `recipients` 필수 입력
2. `customer_id` 미입력 시 accounts.json에서 자동 추출:
   - `args.account ?? args.client_id` 매칭 → fallback to default account
   - 둘 다 실패 시 throw (`customer_id required: not provided and no matching account found`)
3. `upsertClientMapping`으로 client-mappings.json에 atomic write
4. mappings 캐시 invalidate (`_mappingsCache = undefined`) → 후속 read 즉시 반영
5. 중복 client_id는 throw, `overwrite:true`로 replace

**Why:** 다른 세션에서 "hellomax 미등록" 진단 오류 발생. accounts.json엔 등록됐으나 client-mappings.json엔 TBD placeholder만 → weekly tool fail. 두 store 자동 연동 필요.

**How to apply:** 새 client 추가 시 accounts.json 먼저 등록 → `register_client` 호출 (customer_id 자동) → MCP 서버 재시작 불필요 (캐시 invalidate). recipients는 PII라 자동 채울 수 없음 — AE가 명시.

관련: [[mcp-1mb-response-limit]], [[client-mappings-atomic-write]], [[accounts-json-active]].
