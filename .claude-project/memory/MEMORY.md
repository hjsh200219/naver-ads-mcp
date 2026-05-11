# Project Memory Index

영구 저장 가치가 있는 프로젝트별 지식. 매 세션 시작 시 참조.

## Project

- [naver-ads-mcp-stack.md](naver-ads-mcp-stack.md) — TypeScript MCP server stack + 핵심 제약
- [hellomax-template-shape.md](hellomax-template-shape.md) — helloMAX Report Excel 10시트 구조 + 시트 visibility 규칙
- [naver-api-quirks.md](naver-api-quirks.md) — Naver Search Ad API의 비공식 동작·한계 (브랜드검색 영역별 미제공 등)
- [exceljs-width-9-bug.md](exceljs-width-9-bug.md) — ExcelJS width=9 strip 버그 + column.style 우회법
- [multi-account-architecture.md](multi-account-architecture.md) — accounts.json 기반 다중 광고주 자격증명 레지스트리 구조
- [mcp-resources-vs-tools.md](mcp-resources-vs-tools.md) — read-only 메타데이터는 MCP resource로 (system prompt 토큰 ~15-20% 절감)
- [mcp-deployment-local-path.md](mcp-deployment-local-path.md) — MCP 배포는 로컬 경로 유지 결정 (npx + GitHub install 거부됨)
- [eslint-tests-no-inline-disable.md](eslint-tests-no-inline-disable.md) — tests/에서 @typescript-eslint/\* 인라인 disable 금지 (룰 미등록)
- [weekly-report-automation-plan.md](weekly-report-automation-plan.md) — 주간/데일리 리포트 자동화 + 광고주별 Live Artifact 합의 플랜 v1.5 FINAL + Phase 0 게이트
- [anthropic-data-transmission-policy.md](anthropic-data-transmission-policy.md) — 광고주 데이터 외부 LLM 전송 정책 (NDA 허용·PII 최소화·점검 게이트)
- [mcp-responsibility-separation.md](mcp-responsibility-separation.md) — MCP는 자기 도메인에 집중, 이메일 등은 외부 MCP에 표준 payload로 위임 (v1.5 채택)
- [v1.6-lock-semantics-serialize-only.md](v1.6-lock-semantics-serialize-only.md) — v1.6 lock은 prepare 직렬화만, N건 모두 성공. SEND lock 거절 semantics는 v1.5 폐기됨
- [hallucination-guard-date-context-filter.md](hallucination-guard-date-context-filter.md) — review_text 숫자 추출 시 (월/일/주차/주/년/시/분) lookahead로 날짜 컨텍스트 제외, 안 그러면 정상 날짜 표현이 false-positive penalty
- [anthropic-client-lazy-factory.md](anthropic-client-lazy-factory.md) — cli.ts는 AnthropicClient를 lazy factory(`() => new AnthropicClient()`)로 주입, ANTHROPIC_API_KEY 없는 사용자도 기존 5툴 사용 가능
- [gitignore-dirname-anchor.md](gitignore-dirname-anchor.md) — 앵커 없는 `output/` 패턴이 `src/output/`를 삼켜 v1.6 커밋 3파일 누락; 항상 `/dirname/`으로 앵커
- [layer-schema-duplication-ok.md](layer-schema-duplication-ok.md) — L4 config가 L2 스키마 필드를 재선언하는 duplication은 레이어 방향 위반 방지를 위해 의도적 허용
- [history-schema-dual-mode-debt.md](history-schema-dual-mode-debt.md) — HistoryEntrySchema week 필드의 YYYY-Www/YYYY-MM-DD dual-mode는 단기 타협; 데일리 전용 필드 3개+ 시 분리 예정
- [daily-history-per-client-always.md](daily-history-per-client-always.md) — prepare_daily_dashboard는 violation_count 무관 매핑된 광고주당 1건 history 기록 (audit trail 우선, commit f0442ed 이후)

## Reference

- [github-repo.md](github-repo.md) — GitHub repo 위치 + visibility + 주요 commits
- [omc-state-cleanup.md](omc-state-cleanup.md) — Stop hook이 ralph 재시작 시도 시 대응법
- [accounts-json-active.md](accounts-json-active.md) — accounts.json 단일 자격증명 소스 운영 (.env 제거됨)
- [anthropic-mock-shape.md](anthropic-mock-shape.md) — IAnthropic.generate 모킹 반환 shape: {content: JSON-stringified string, cache_hit: boolean}

## Feedback

- [korean-output-style.md](korean-output-style.md) — 사용자 응답 스타일 선호
- [ralplan-codex-consensus-pattern.md](ralplan-codex-consensus-pattern.md) — ralplan 4 라운드 + Codex adversarial 외부 challenge로 같은-패밀리 합의의 blind spot 보완
- [prd-vs-impl-drift-clean-path-test.md](prd-vs-impl-drift-clean-path-test.md) — PRD가 "per X 1건" 카디널리티 명시하면 clean-path 카운트도 회귀 테스트로 단언 (breach-path만 검증 시 drift)
