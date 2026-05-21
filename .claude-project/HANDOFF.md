---
created: 2026-05-21T23:30:00+09:00
project: naver-ads-mcp
summary: Desktop 실전 호출에서 발견된 5개 실패 모드 fix — Anthropic SDK 호출 시도/sandbox 경로/cwd="/" mkdir fail/artifact 미렌더/형식 선택 안 묻기. 354/354 pass 유지.
---

## Session Digest

이전 push (698defd) 이후 Claude Desktop으로 weekly 보고서 e2e 시도하며 발견된 5개 실패 모드 순차 fix. 각각 코드/description 변경으로 해결. 모두 호스트 dry-run으로 통과 확인. Desktop 재시작 + 재호출이 다음 검증 단계.

## Progress

- ✅ **ab5b3ae**: weekly/daily live API path 미래 statDt skip + 4xx continue (Naver API 400 fail 해결)
- ✅ **a0eafe4**: generate_weekly_analysis_prompt description 강화 — "YOU (calling LLM) are analyst. Do NOT call external Anthropic API"
- ✅ **23e59e7**: generate_report outputPath required → optional 정정. outputPath description에 "host 머신 경로, caller sandbox 금지" 명시
- ✅ **ea02abd**: cli.ts에서 import.meta.url로 project root 계산 → REPORTS_BASE_DIR을 서버에 명시 주입. Desktop이 cwd="/" 설정해도 안전. server.ts fallback default도 `process.cwd()` → `os.homedir()` 로 변경
- ✅ **81032b5**: finalize_weekly_dashboard description에 "artifact_html을 Claude Desktop artifact UI(text/html)로 렌더링" 명시. README "리포트 선택 가이드" + "Artifact 렌더링" 섹션 신규
- ✅ **20cf021**: prepare_weekly_payload + generate_report 양쪽 description 첫머리에 "STOP — BEFORE CALLING: 형식 선택 안 했으면 ASK first" 강제 (한쪽만 넣으면 다른 path가 default됨)
- ✅ 354/354 tests pass, typecheck 0 errors
- ✅ Memory 3건 신규: mcp-server-cwd-pitfall, caller-sandbox-vs-host-paths, tool-description-llm-guidance-limits

## Next Steps

1. **Claude Desktop 완전 종료(Cmd+Q) + 재실행** → MCP 서버 재spawn, 최신 코드 + tool description 로드 확인. log에 `reports=<project>/reports` 라인 보이면 성공
2. **"이번주 hellomax 리포트" 재호출** → Desktop이 (A) raw 10시트 vs (B) weekly dashboard 옵션 묻고 진행 확인
3. **사용자가 (B) 선택** → prepare_weekly_payload → generate_weekly_analysis_prompt → finalize_weekly_dashboard 통과 + artifact UI 렌더 확인
4. **chmod 600 accounts.json** (warning 매 startup)
5. **만약 Desktop이 여전히 안 묻으면** → dispatcher tool 도입 검토 (단일 entry tool이 사용자 응답 기반 분기). 코드 description 강제로 부족 시 유일 대안

## Blockers

- 없음

## Watch Out

- **Desktop tsx 모듈 캐시**: file 변경해도 process 살아있으면 옛 코드 reuse. 항상 Cmd+Q 후 재실행
- **artifact 렌더링은 client 정책 의존**: description으로 유도만 가능, Desktop 측 구현에 따라 안 될 수 있음
- **caller sandbox 경로**: Desktop이 자기 sandbox 경로(`/home/claude`, `/mnt/user-data`) 인식 → 가끔 그 경로 outputPath로 전달. description에 명시했으나 LLM 무시 가능. 사용자가 outputPath 생략 권장
- **REPORTS_BASE_DIR 정합**: cli.ts에서 명시 주입. 단 server.ts library mode(외부 import 시) fallback은 `os.homedir()` — homedir 가정 위험할 경우 deps.reportsBaseDir 명시 권장
- **weekly live path partial data**: 진행 중인 주는 미래 일자 silent skip → kpi_current이 7일치 아님

## Files Touched

- src/mcp/server.ts (description 강화, REPORTS_BASE_DIR fallback)
- src/cli.ts (project root resolve + REPORTS_BASE_DIR 주입)
- README.md (리포트 선택 가이드 + artifact 섹션)
- .claude-project/memory/{mcp-server-cwd-pitfall, caller-sandbox-vs-host-paths, tool-description-llm-guidance-limits}.md (신규)
