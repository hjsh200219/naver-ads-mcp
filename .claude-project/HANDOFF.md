---
created: 2026-05-08T15:18:00+09:00
project: naver-ads-mcp
summary: 참조 템플릿 픽셀 패리티 + 다중 광고주 자격증명 레지스트리 (accounts.json) 구현 완료
---

## Session Digest

두 가지 큰 작업을 한 세션에서 완료하고 main에 2커밋으로 push:

1. **참조 템플릿 픽셀 패리티** (`906bea9`) — `docs/references/(FORM) helloMAX Report.xlsx`와 시트 구조·헤더·번호서식·fill·폰트·테두리·컬럼너비까지 동일하게 출력. ExcelJS의 width=9 strip 버그를 column.style 할당으로 우회.

2. **다중 광고주 레지스트리** (`7f28dbe`) — `accounts.json` 기반 다계정 관리. 모든 MCP 도구에 `account?` 인자 추가, 신규 `list_accounts` 도구. 기존 `.env` 단일 계정 사용자 무중단 fallback.

Architect+Critic 합의 후 ralph TDD-first 구현. 라이브 .env로 validate_credentials API 통과 확인.

## Progress

**완료**

- [x] 참조 파일 구조 전체 덤프 (SUMMARY/매체별/키워드/상품/검색어/브랜드검색 + 4개 RAW)
- [x] `src/excel/styles.ts` 신규 — 폰트/fill/border/numFmt/widths 상수
- [x] `src/excel/writer.ts` 전면 재작성 — `renderPivotSection` 헬퍼, 모든 섹션 구현
- [x] Pivot 빌더 5개 시그니처 변경 — `MetricsGroup[]` 반환 (PivotCell[][] 폐기)
- [x] RAW 헤더 trailing dot, Date 컬럼 mm-dd-yy, numeric `#,##0` 적용
- [x] `tests/e2e-reference-parity.test.ts` 28 tests — 구조/포맷/스타일 패리티 검증
- [x] `src/config/account-store.ts` (L4) — IAccountStore + MapAccountStore + AccountNotFoundError
- [x] `src/config/credentials.ts` — `freezeCredential` 헬퍼 추출
- [x] `src/runtime/account-bootstrap.ts` (L1) — JSON 파일 read + env fallback
- [x] `src/mcp/server.ts` — account 인자 라우팅, customerId 기반 클라이언트 캐싱, list_accounts 도구
- [x] `src/cli.ts` — startup 시 eager loadAccountStore (fail-fast)
- [x] 22개 신규 테스트 (account-store/account-bootstrap/mcp-multiaccount/layer-rules)
- [x] `accounts.example.json` (≥2 계정), `.gitignore`에 `accounts.json` 추가
- [x] `docs/SECURITY.md` 다중 광고주 + transcript-leak residual 섹션
- [x] `docs/design-docs/layer-rules.md`에 `src/runtime/*` = L1 등재
- [x] README 다중 광고주 등록/사용 가이드 + 키 회전 시 재시작 명시
- [x] 라이브 smoke: `validate_credentials({})` → Naver API 인증 통과
- [x] typecheck 0 errors, 204/204 tests GREEN, lint clean
- [x] git push origin main (2 commits: 906bea9, 7f28dbe)

**미완료 (후속 작업 후보)**

- [ ] `accounts.json` 핫리로드 (`fs.watch` + 동시 호출 안전 자격증명 갱신)
- [ ] OS Keychain / libsecret 기반 암호화 저장소
- [ ] CI에 `RUN_LIVE=1 npm test` 자동화 (실 자격증명 smoke)
- [ ] `package.json` 버전 0.2.0 publish 절차

## Next Steps

1. 멀티 광고주 환경 실사용 검증 — 2개 이상 실제 광고주 등록 후 `generate_report({account: "..."})` 테스트
2. `tests/e2e-reference-parity.test.ts`의 잔여 1 WARN (검색어RAW 날짜 컬럼 width=null vs 11.125) 처리 여부 결정
3. README 영문 번역 검토 (현재 한글만)

## Blockers

없음.

## Watch Out

- **자격증명 회전 시 MCP 서버 재시작 필수** — `accounts.json` 편집 후 Claude Code 재기동. 핫리로드 미지원.
- **account label은 LLM transcript에 노출됨** — 광고주 실명 대신 `acc1`, `client-001` 같은 opaque label 권장.
- **ExcelJS width=9 strip 버그** — `setColumnWidths`에서 모든 컬럼에 `col.style = { font: ... }` 할당 필수. 안 하면 cols 4-8 너비가 저장 안 됨.
- **Pivot builder 시그니처 변경** — 외부 코드가 `pivot.rows[]` 모양에 의존했다면 전부 깨짐. 현재 코드베이스는 writer만 의존하므로 안전.
- **`.claude-project/`는 git 추적됨** — 시크릿 절대 저장 금지. `accounts.json`은 `.gitignore` 등록됨.

## Files Touched

**신규 (10)**:

- `src/config/account-store.ts`
- `src/excel/styles.ts`
- `src/runtime/account-bootstrap.ts`
- `accounts.example.json`
- `tests/account-store.test.ts`
- `tests/account-bootstrap.test.ts`
- `tests/mcp-multiaccount.test.ts`
- `tests/layer-rules.test.ts`
- `tests/e2e-reference-parity.test.ts`
- `scripts/{compare-with-reference,dump-reference-full,dump-reference-skeleton,inspect-reference}.mjs`

**수정**:

- `src/cli.ts`, `src/mcp/server.ts`, `src/config/credentials.ts`
- `src/excel/{headers,writer}.ts`, `src/pivot/{types,summary,media,keyword,product,search-term}.ts`
- `tests/{e2e,excel,mcp,pivot}.test.ts`
- `.gitignore`, `README.md`, `docs/SECURITY.md`, `docs/design-docs/layer-rules.md`

## Commits

- `7f28dbe` feat(mcp): multi-advertiser credential registry via accounts.json
- `906bea9` feat(report): pixel-parity with helloMAX reference Excel template
