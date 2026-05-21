---
created: 2026-05-21T19:00:00+09:00
project: naver-ads-mcp
summary: 5 commit pushed — getKeywords+stat-reports 다운로드 버그픽스, Anthropic 의존성 제거+3-tool 분리, catch-swallow 좁히기, timezone 기본값. parseTsv 헤더 corruption 발견(별도 작업).
---

## Session Digest

5개 commit (origin/main push 완료, 59cfd89..629843a):

1. `fix(api)`: getKeywords adGroupId 필수화 + stat-reports HMAC 서명 다운로드 + gzip 조건부 분기 (629843a)
2. `refactor(mcp)`: prepare_weekly_dashboard → 3-tool 분리. Anthropic SDK 의존성 완전 제거. MCP surface 5 → 7 tools. (c3d2dff)
3. `docs(parser/types)`: hallucination guard 표현 제거 → "host LLM 입력 계약" (014c081)
4. `fix(mcp/server)`: generate_report catch-swallow 좁히기 — StatReportFailedError NONE/FAILED만 건너뛰기, 그 외 throw (d13427a)
5. `feat(runtime)`: ensureDefaultTimezone Asia/Seoul 기본값 (59cfd89)

## Progress

### 완료

- ✅ getKeywords 버그 (adGroupId required + getAllKeywords helper)
- ✅ stat-reports 다운로드 (HMAC 서명 + gzip magic-byte 조건부)
- ✅ INaverAdsClient.downloadBinary 메서드 추가
- ✅ Anthropic SDK 의존성 완전 제거 (5 파일 삭제: api/anthropic.ts, config/anthropic-credentials.ts, analyzer/ai-comment.ts, 관련 테스트 2개)
- ✅ 3-tool 분리 (prepare_weekly_payload + generate_weekly_analysis_prompt + finalize_weekly_dashboard). 분석은 host Claude가 직접 담당
- ✅ catch-swallow silent failure 방지
- ✅ vitest 372/372 pass, typecheck 0 errors
- ✅ 실측 검증 (validate_credentials OK, AD 1359 / AD_DETAIL 3146 / EXPKEYWORD 620 rows, 3-tool 흐름 정상)
- ✅ accounts.json 권한 600

### 미완료 (중대)

- ❌ **parseTsv 헤더 처리** — 네이버 v2 응답 header 없음 확정 (실측). 첫 줄을 header로 잡아서 모든 RAW 데이터 silent corruption ('unknown' / 'NaN-NaN' / Invalid Date). xlsx는 생성되지만 내용 무효. reportTp별 column 순서 매핑 필요. 작업 큼 (10+ 파일).
- ❌ **prepare_daily_dashboard live wiring** — 코드 명시적 throw ("live buildDailyRaw wiring is not yet implemented"). parseTsv 수정 선행 필요.

## Next Steps

1. **최우선**: Naver Search Ad API 공식 docs에서 각 reportTp별 column 순서 정의 확인
   - reportTp 10개: AD / AD_DETAIL / AD_CONVERSION / AD_CONVERSION_DETAIL / EXPKEYWORD / SHOPPINGKEYWORD_DETAIL / SHOPPINGKEYWORD_CONVERSION_DETAIL / SHOPPINGBRANDPRODUCT / SHOPPINGBRANDPRODUCT_CONVERSION / BRND_CONTRACT
   - AD 실측 14컬럼: `[statDt, customerId, nccCampaignId, nccAdgroupId, nccKeywordId, nccAdId, businessId, ?, deviceCode, impCnt, ?, ?, ?, ?]` — 6/14만 추정됨
2. parseTsv를 index-based로 변경 (`string[][]` 또는 `Record<number, string>`)
3. raw builder들(daily/keyword/search-term/material) column index 매핑 추가
4. 기존 fixture/test 재작성 (header 없는 raw row 포맷)
5. prepare_daily_dashboard live wiring 구현 (parseTsv 완료 후)

## Blockers

- **Naver API column 순서 문서 필요** — 실측만으론 14개 컬럼 의미 추정 불완전. 공식 docs 또는 production 응답 더 많이 수집 필요.

## Watch Out

- **silent corruption 주의**: parseTsv 헤더 가정 버그로 현재 generate_report 결과 xlsx는 만들어지지만 RAW 시트 내용 무효. 사용자에게 안내 필요.
- generate_report outputPath는 macOS 절대경로로 (`/Users/...`). `/home/claude/` 같은 컨테이너 경로는 ENOENT.
- accounts.json 권한 600 유지. 644면 stderr 경고만, 동작은 함.
- MCP host (Claude desktop)는 3-tool 흐름 알아야 함: prepare_weekly_payload → (Claude 분석) → generate_weekly_analysis_prompt → (AiAnalysis JSON 작성) → finalize_weekly_dashboard.
- generate_report fetchAll catch는 이제 StatReportFailedError만 swallow. 네트워크/401/5xx는 throw해서 호출자 노출.

## Files Touched

### Source 수정

- src/api/client.ts (downloadBinary 추가, +35줄)
- src/api/metadata.ts (getKeywords required + getAllKeywords)
- src/api/stat-reports.ts (서명 다운로드 + gzip 조건부)
- src/api/types.ts (INaverAdsClient.downloadBinary)
- src/mcp/server.ts (3-tool 분리, anthropic 제거, catch-swallow 좁히기)
- src/cli.ts (AnthropicClient 제거, timezone import)
- src/parser/types.ts (주석 갱신)

### Source 신규

- src/analyzer/weekly-prompt.ts (buildSystemPrompt/buildUserPrompt/buildPayloadSummaryMd/EXPECTED_AI_ANALYSIS_SCHEMA)
- src/runtime/timezone.ts (ensureDefaultTimezone)

### Source 삭제

- src/api/anthropic.ts
- src/config/anthropic-credentials.ts
- src/analyzer/ai-comment.ts

### Tests

- tests/e2e.test.ts (downloadBinary mock + regression test)
- tests/e2e-reference-parity.test.ts (downloadBinary mock)
- tests/mcp.test.ts (9 tools + downloadBinary mock)
- tests/mcp-multiaccount.test.ts (downloadBinary mock)
- tests/stat-reports.test.ts (downloadBinary stub + plain TSV 케이스)
- tests/prepare-weekly-dashboard.test.ts (3-tool 흐름 재작성, 8 → 12 tests)
- tests/layer-rules.test.ts (anthropic-credentials 제거)
- tests/timezone.test.ts (신규)
- tests/anthropic-credentials.test.ts (삭제)
- tests/ai-comment.test.ts (삭제)

### Docs

- README.md (MCP surface 5→7)
- AGENTS.md / CLAUDE.md (MCP surface + 3-stage 파이프라인)
- package.json (@anthropic-ai/sdk 제거)
