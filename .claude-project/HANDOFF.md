---
created: 2026-05-21T20:30:00+09:00
project: naver-ads-mcp
summary: commit 42bce5b — register_client tool 신규 + fetch_raw_data 1MB-safe 옵션 (outputPath/summarize/limit). client-mappings.json atomic write + customer_id auto-fill. tools 7→8, 394/394 pass.
---

## Session Digest

다른 Claude Desktop 세션에서 "hellomax 미등록" 진단 오류 → 실제 원인은 accounts.json은 OK, **client-mappings.json에 hellomax entry 없음**. weekly/daily tool은 두 store 모두 필요한 구조였음.

해결: `register_client` MCP tool 신규. accounts.json에서 `customer_id` 자동 추출 + atomic upsert. 별도로 Desktop에서 `fetch_raw_data` 1MB 초과 에러 보고 → `outputPath` / `summarize` / `limit` 옵션 + 자동 가드 추가.

## Progress

- ✅ `src/runtime/client-mappings-writer.ts` 신규 — atomic write + advisory lock + schema validate
- ✅ `register_client` MCP tool — customer_id auto-fill, overwrite 지원, 캐시 invalidate
- ✅ `fetch_raw_data` 옵션: `outputPath` / `summarize` / `limit` + >900KB 자동 hint
- ✅ `prepare_weekly_payload` warnings 필드 — 미등록 client_id 안내
- ✅ `finalize_weekly_dashboard` data_warnings에 동일 안내 merge
- ✅ 신규 테스트 18개 (writer 9 + register-client 9 + fetch_raw_data 3)
- ✅ typecheck 0, vitest 394/394, build OK
- ✅ commit 42bce5b push (origin/main)
- ✅ AGENTS.md: tool 7→8 + test 388→394 갱신
- ✅ Memory 3건 신규 저장

## Next Steps

1. **hellomax 실제 등록** — Claude Desktop에서 `register_client({client_id:"hellomax", recipients:["..."]})` 호출 (recipients = AE/광고주 메일, 별도 확인 필요)
2. **chmod 600 accounts.json** — 현재 644 (MCP 서버 매번 warning). 변경 후 서버 재시작
3. **placeholder client-1~6 정리** — TBD entry 제거 여부 결정 (현재 6건 자리만 차지)
4. **Claude Desktop e2e 검증** — register_client 호출 → prepare_weekly_payload → finalize → 발송 흐름 통과 확인
5. **fetch_raw_data 활용** — 큰 raw fetch는 `outputPath:"/tmp/<client>-<reportTp>-<week>.json"` 패턴 권장

## Blockers

- 없음

## Watch Out

- **client-mappings 캐시**: register_client는 등록 직후 `_mappingsCache = undefined` 처리하나, 별도 MCP 서버 인스턴스(예: 다른 Desktop 창)가 떠 있으면 그쪽은 stale. 서버 재시작 권장
- **자동 customer_id 자동 추출**: `account` 명시 안 하면 `client_id` → default account 순서로 매칭. 의도 다르면 `account:"<name>"` 명시
- **recipients PII**: accounts.json에 없음, 자동 채울 수 없음. register_client 호출 시 사용자가 명시 필수
- **fetch_raw_data 자동 가드**: hint 반환 시 실제 데이터는 응답에 없음 → 재호출 필요. tool description에 명시되어 있음
- **proper-lockfile**: 동시 register_client는 직렬화. high-frequency 호출 시 timeout (현재는 AE 수동이라 무관)

## Files Touched

- `src/runtime/client-mappings-writer.ts` (신규, 92 lines)
- `src/mcp/server.ts` (+235 lines: schema/tool def/handler/dispatch/export + fetch_raw_data 옵션 + weekly warnings)
- `tests/client-mappings-writer.test.ts` (신규, 157 lines)
- `tests/register-client.test.ts` (신규, 206 lines)
- `tests/mcp.test.ts` (+104 lines: tool count + fetch_raw_data 3 cases)
- `AGENTS.md` (tool 7→8 + test 388→394)
- `.claude-project/memory/{register-client-tool-pattern,client-mappings-atomic-write,mcp-1mb-response-limit}.md` (신규 3건)
