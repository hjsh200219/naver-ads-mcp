---
created: 2026-05-21T22:00:00+09:00
project: naver-ads-mcp
summary: commit ab5b3ae — weekly/daily live API path가 미래 statDt에 HTTP 400으로 전체 fail. statDt > today skip + NaverAdsApiError 4xx continue로 graceful degrade. dry-run hellomax 2026-W21 실데이터 성공.
---

## Session Digest

직전 commit `a2fa57a`로 prepare_weekly_payload live API path 추가. Desktop에서 호출하니 "Client error (400)" 전체 fail. 원인: Naver API가 미래 일자(`statDt > today`)에 HTTP 400 reject. ISO week `[Mon, Sun]` 7일치 fetch는 진행 중인 주에서 5/22~5/24 등 미래일자 포함 → 첫 throw에서 abort.

해결 (commit `ab5b3ae`): `fetchByDay`(weekly) + `fetchOne`(daily) 양쪽에서 (1) `statDt > today` skip (2) `NaverAdsApiError 4xx`도 `StatReportFailedError`처럼 continue. 5xx만 throw 유지.

## Progress

- ✅ src/mcp/server.ts fetchByDay: 미래 statDt skip + 4xx continue
- ✅ src/mcp/server.ts fetchOne: 동일 패치
- ✅ dry-run prepare_weekly_payload({client:"hellomax", week:"2026-W21"}) 실데이터 성공 (kpi_current.impressions=12794, cost=100428)
- ✅ vitest 354/354 pass, typecheck 0 errors
- ✅ commit ab5b3ae push (origin/main)
- ✅ Memory: naver-api-quirks.md에 "미래 statDt = 400" 섹션 추가

## Next Steps

1. **Claude Desktop 완전 종료 + 재실행** — MCP 서버 재spawn 필요 (tsx 모듈 캐시 invalidate). 현재 Desktop은 ab5b3ae 이전 코드 메모리에 보유 가능
2. **Desktop e2e**: `prepare_weekly_payload({client:"hellomax", week:"2026-W21"})` → `generate_weekly_analysis_prompt` → host LLM 분석 → `finalize_weekly_dashboard` 전체 흐름
3. **chmod 600 accounts.json** (644 warning 매 startup)
4. **classifyConvTp 매핑 정확성** 검토 — AE 수동 분류와 Naver conversionType code 매칭 결과 비교 (구매완료/회원가입/신청완료/기타전환)
5. **hygiene refactor** (low priority): `todayCompact` / `todayCompactDaily` 변수 중복 — fetchLiveWeeklyPayload + defaultLiveDailyProvider 외부로 hoist 가능

## Blockers

- 없음

## Watch Out

- **partial data 가능성**: live path는 미래/4xx 일자 silent skip → 진행 중인 주는 부분 데이터만 반환 (kpi_current이 7일치 아닐 수 있음)
- **5xx fail-fast 유지**: 진짜 API 장애 시 weekly/daily tool throw → 의도된 behavior
- **Desktop tsx 캐시**: source 변경해도 MCP 서버 프로세스 살아있는 한 메모리 모듈 reuse. 재시작 필수
- **NaverAdsApiError.status 의존**: 400/401/403/404 모두 동일 skip. 401(인증)도 skip되니 자격증명 만료 시 silent partial → `validate_credentials` 별도 점검 권장

## Files Touched

- src/mcp/server.ts (+21 lines: fetchByDay/fetchOne 가드)
- .claude-project/memory/naver-api-quirks.md (미래 statDt 섹션 추가)
