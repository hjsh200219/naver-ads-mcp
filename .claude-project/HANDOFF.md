---
created: 2026-05-21T22:00:00+09:00
project: naver-ads-mcp
summary: 1 commit pushed (d501a87) — parseTsv 헤더 corruption 8주 silent bug 수정, /stats API cross-check로 5/10 reportTp verified, 미검증 5개는 UnsupportedReportTypeError throw, prepare_daily_dashboard live wiring 완료. 실측 generate_report 1037 valid rows, prepare_daily_dashboard cpc_mom 179% breach 탐지.
---

## Session Digest

1개 commit (origin/main push 완료, 643136a..d501a87):

1. `fix(api/parser)`: parseTsv 헤더 가정 제거 + reportTp별 index-based column 매핑 + prepare_daily_dashboard live wiring (d501a87, +1113 / -163 lines)

## Progress

### 완료

- ✅ **parseTsv 헤더 corruption 수정** — 8주간 silent bug. stat-report v2 응답은 header 없는 raw TSV인데 첫 줄을 header로 가정해 모든 RAW 시트 'unknown'/NaN로 채워지던 문제 해결. `parseTsv(text, reportTp)` 시그니처로 변경, reportTp별 index-based column map 적용.
- ✅ **/stats API cross-check 검증** — AD / AD_DETAIL / AD_CONVERSION / AD_CONVERSION_DETAIL / EXPKEYWORD 5개 reportTp column 순서 실측 검증 (`scripts/verify-stat-columns.mjs`).
- ✅ **UnsupportedReportTypeError** — 미검증 5개 reportTp (SHOPPINGKEYWORD_DETAIL, SHOPPINGKEYWORD_CONVERSION_DETAIL, SHOPPINGBRANDPRODUCT, SHOPPINGBRANDPRODUCT_CONVERSION, BRND_CONTRACT)는 명시적 throw. fabrication 방지.
- ✅ **prepare_daily_dashboard live wiring** — `defaultLiveDailyProvider` 신설. client_id → customer_id (mappings) → account name (accountStore) 매핑 후 AD + AD_CONVERSION fetch → buildDailyRaw → aggregateDailyPayload. 매핑 없는 client는 empty payload + warning (다른 client 계속 처리).
- ✅ **avgRnk 자동 파생**: avgRnkWeighted ÷ impCnt (impCnt=0 → 0)
- ✅ **normalizeDevice**: stat-report v2 단일문자 "P"/"M" 정규화 추가
- ✅ **classifyConvTp**: 문자열 convTpName "lead"/"purchase"/"signup" 매핑 추가
- ✅ **findAccountForClient**: getStore() 사용으로 env-only mode 지원
- ✅ vitest 373/373 pass, typecheck 0, lint/build clean
- ✅ **실측 검증**:
  - live `generate_report` (hellomax, 2026-05-12): 일별RAW 1037 valid rows, 0 'unknown'
  - live `prepare_daily_dashboard`: cpc_mom 179% breach 탐지, history JSONL 기록 OK
- ✅ 4 신규 verification/live 스크립트 (scripts/)
- ✅ 메모리 갱신: `stat-report-column-spec.md` 신규 / `parsetsv-header-bug.md` 삭제

## Next Steps

1. **미검증 reportTp 5개 verify** — shopping advertiser 계정 sample 확보 필요:
   - SHOPPINGKEYWORD_DETAIL, SHOPPINGKEYWORD_CONVERSION_DETAIL
   - SHOPPINGBRANDPRODUCT, SHOPPINGBRANDPRODUCT_CONVERSION
   - BRND_CONTRACT
   - 검증 후 UnsupportedReportTypeError 해제 + column map 추가
2. **client-mappings.json 채우기** — 전체 customer_id="TBD" 상태. ops가 production daily dashboard 운영 전에 실제 customer_id 입력해야 hellomax 외 client 동작.
3. **EXPKEYWORD col8 검증** — `avgRnkWeighted` 추정. impCnt mismatch는 Naver issue #1080 확인됨. shopping reportTp verify 작업 시 함께 재확인.

## Blockers

- **Shopping advertiser sample 부재** — 미검증 5개 reportTp는 hellomax(검색광고 only) 계정으로 검증 불가. 쇼핑광고 운영하는 client 계정 접근 필요.
- **client-mappings.json customer_id 미입력** — hellomax 외 client는 prepare_daily_dashboard가 empty payload + warning 반환. production 운영 전 ops 작업 필요.

## Watch Out

- **silent corruption 해결됨** — d501a87 이전 빌드는 RAW 시트 무효. 이전 보고서 재생성 권장.
- **5개 미검증 reportTp는 throw** — generate_report에서 해당 reportTp 호출 시 UnsupportedReportTypeError. 임시 우회 필요 시 fabrication 위험 인지 후 진행.
- **prepare_daily_dashboard live mode** — accountStore에 client_id mapping 없으면 empty payload(warning). 에러 throw 아니라서 호출측에서 payload 비어있는지 검사 필요.
- **avgRnk 파생값 의미** — `avgRnkWeighted ÷ impCnt`로 자동 계산. impCnt=0인 row는 0 (NaN 방지).
- generate_report outputPath는 macOS 절대경로 (`/Users/...`). `/home/claude/`는 ENOENT.
- accounts.json 권한 600 유지.

## Files Touched

### Source 수정

- src/api/stat-reports.ts (parseTsv reportTp 매핑 + UnsupportedReportTypeError + helper들, +182 lines)
- src/mcp/server.ts (defaultLiveDailyProvider + findAccountForClient getStore() 전환, +153 lines)
- src/raw/builder.ts (parseTsv 시그니처 변경 대응)

### Tests

- tests/stat-reports.test.ts (reportTp별 column map + UnsupportedReportTypeError 케이스, +139 lines)
- tests/e2e.test.ts (parseTsv 시그니처 + live raw 형식)
- tests/e2e-reference-parity.test.ts (parseTsv 시그니처)
- tests/mcp.test.ts (defaultLiveDailyProvider mock)

### Scripts (신규)

- scripts/sample-stat-reports.mjs (reportTp별 raw TSV 샘플 수집)
- scripts/verify-stat-columns.mjs (/stats API cross-check)
- scripts/live-generate-report.mjs (live generate_report 검증)
- scripts/live-prepare-daily.mjs (live prepare_daily_dashboard 검증)

### Memory

- .claude-project/memory/stat-report-column-spec.md (신규, 5/10 verified + 미검증 5개 표시)
- .claude-project/memory/parsetsv-header-bug.md (삭제, d501a87로 해결)
- .claude-project/memory/MEMORY.md (인덱스 갱신)

### Misc

- .gitignore (live 검증 산출물 제외)
