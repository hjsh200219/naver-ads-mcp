---
name: mcp-1mb-response-limit
description: MCP transport는 응답 1MB 제한. 큰 결과는 outputPath 패턴으로 파일 저장 + 경로만 반환
type: reference
created: 2026-05-21
---

MCP JSON-RPC response payload는 ~1MB 제한 (Claude Desktop 에러: "Tool result is too large. Maximum size is 1MB."). `fetch_raw_data` 같은 대량 row 반환 tool은 7일치 AD report만 해도 초과 가능.

**대응 패턴** (fetch_raw_data, src/mcp/server.ts):

- `outputPath`: 모든 rows를 JSON으로 파일에 쓰고 응답엔 `{path, count, perDate}`만 반환
- `summarize`: rows 생략, `{count, perDate}` 반환
- `limit`: 응답 row 캡 + `truncated:true` 플래그
- **자동 가드**: 직렬화 크기 >900KB 이면 rows 빼고 `hint` 안내 반환 (call-site에 옵션 사용 권장)

**Why:** Claude Desktop에서 7일 AD raw fetch 시 1MB 초과로 tool 실패. 호스트가 응답을 받지 못해 후속 처리 불가.

**How to apply:** 큰 데이터 반환하는 신규 tool은 처음부터 outputPath 옵션 또는 summarize 모드 제공. tool 정의 description에 1MB 제약 언급. 자동 가드 임계값은 900KB (1MB 안전 마진).

관련: [[register-client-tool-pattern]] (같은 commit 42bce5b).
