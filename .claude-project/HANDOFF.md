---
created: 2026-08-13T00:47:00+09:00
project: naver-ads-mcp
summary: 광고회사용 2회차 사례 중심 강의 계획서 작성 + 교안 3종 shconsulting 이관. 후속으로 docs/SECURITY.md 정정 중 PUBLIC repo에 미익명화 실 계정 데이터가 push된 상태를 발견(미해결). 45eec3c / ed0b03d / 387353d / 65b65e4.
---

## Session Digest

문서 전용 세션. (1) 기존 `zb-lecture-plan-1-7.md`(7회차, 520줄) 확인 → (2) 광고회사 대상 `adagency-lecture-plan-1-2.md`(340줄) 신규 작성 — 1회차 유지, 기존 2~7회차를 업무 사례 5개로 재편 → (3) 교안 3종을 `shconsulting/docs/ax-lecture/`로 이관 → (4) `docs/SECURITY.md:109`의 거짓 서술 정정.

(4)의 검증 과정에서 **PUBLIC repo에 미익명화 실 계정 광고 데이터가 push되어 있음을 발견**했다. 문서는 고쳤으나 노출 자체는 미해결. 코드 변경 없음 (lint 0 / typecheck 0 / test 359 / build 통과).

## Progress

- ✅ `adagency-lecture-plan-1-2.md` 신규 작성 (340줄). 2회차 = 사례 5개, 핸즈온 1개(사례 1 주간 리포트) + 시연 4개. 설치 7개는 사전 과제로 이관
- ✅ 사례 근거를 `(사업) 광고운영부서 업무 Workflow 작성_260429.docx`의 STEP·소요시간·Pain Point에서 도출 (가상 예제 아님)
- ✅ 원본 7회차 → 2회차 커버리지 표 + 삭제 8개 명시(OMC, CCG, TDD, 하네스, 재배포 디버깅, OAuth, Google Cloud Console, gstack)
- ✅ 교안 3종 이관 `shconsulting/docs/ax-lecture/` (`ed0b03d`, rebase 후 push) / 원본 삭제 + `.gitignore` OMC 패턴 보강 (`45eec3c`)
- ✅ `docs/SECURITY.md:109` 정정 (`65b65e4`) — `.claudeignore:30`은 등록됨, `.gitignore`는 미등록이 사실
- ✅ memory 정정: `docs-references-inventory`의 "익명화된 form 원본"이 **허위**임을 exceljs 대조로 확인 후 수정
- ⬜ **PUBLIC repo 실 계정 데이터 노출 — 미해결** (Next Steps 1)
- ⬜ 같은 거짓 주장이 exec-plans 3곳에 잔존 + SECURITY.md 다른 오류 3건 (Next Steps 2)
- ⬜ `(사업) 광고운영부서 업무 Workflow.docx` 교안 폴더 이관 여부 — 사용자 미결정

## Next Steps

1. **[최우선] PUBLIC repo에 미익명화 실 계정 데이터가 push된 상태 해소.**
   - 확인된 사실: `gh repo view hjsh200219/naver-ads-mcp` → `PUBLIC`. `docs/references/` 4개가 git 추적 + `origin/main` 존재. xlsx는 미익명화 — 캠페인명 `헬로맥스AI에이전트#파워링크#PC`, `일별RAW` 181행 실 광고비(12080·29420·17490·19980), `키워드RAW` 14,702행.
   - 제거 3단계: (1) `tests/e2e-reference-parity.test.ts:130-136`의 `REF_PATH`를 `tests/fixtures/anonymized/client-a-form.xlsx`로 이전 — **난이도 중**, parity 테스트가 원본 대조용이라 익명화본으로 대조가 성립하는지 검증 필요. (2) `.gitignore` 등록 + `git rm --cached` — **난이도 낮음**. (3) history 재작성 + 강제 push — **난이도 높음**, 협업자 영향.
   - **1·2단계만으로는 이미 push된 이력이 남는다.** PUBLIC이므로 3단계 없이는 노출 계속.
   - 대안 판단: repo를 Private으로 전환하면 3단계 없이 노출을 끊을 수 있다 — 사용자 결정 필요.
   - 상세: `.claude-project/memory/claudeignore-vs-gitignore-scope.md`
2. **문서 오류 일괄 정정** (Agent 감사에서 검증된 불일치, 미적용):
   - `docs/SECURITY.md:58` — "`X-Timestamp`, `X-API-KEY` 헤더만 전송" → 실제 4개(`src/api/signer.ts:19-24`). 서명 본체 `X-Signature` 누락
   - `docs/SECURITY.md:99` — 키 로테이션 절차의 `.env` 키 이름이 `ACCESS_LICENSE`/`SECRET_KEY` → 실제 `NAVER_ADS_ACCESS_LICENSE`/`NAVER_ADS_SECRET_KEY` (`src/config/credentials.ts:60-62`). **그대로 따르면 실패한다**
   - `docs/SECURITY.md:111` — 산출 경로 `output/` → 실제 `reports/`(`src/cli.ts:24`), "등록 권장"이 아니라 `.gitignore:41` 등록 완료. `src/output/`이 소스 디렉터리라 앵커 없는 `output/`은 커밋 누락 사고(30c5738) 재유도
   - `docs/RELIABILITY.md:74` — "단일 광고주 계정만 지원"은 accounts.json 도입 전 서술 (`5a369d9` 이후 미갱신)
   - `docs/exec-plans/active/weekly-report-automation-plan.md:184,399`, `…-critic-review.md:160` — `docs/references/`가 `.gitignore` 등록이라는 **같은 거짓 주장 3곳 잔존**. critic-review:160은 그걸 근거로 "CI에 못 올림" 결론까지 냄
   - `.env.example:8-13` — `ANTHROPIC_API_KEY` 소비처 0건(`c3d2dff`에서 의존성 제거). 불필요한 비밀키 확산 유도
3. **(사용자 결정 대기)** `(사업) 광고운영부서 업무 Workflow.docx` 교안 폴더 이관 여부. 강의 사례 근거이면서 helloMAX 사업 문서라 양쪽 성격을 겸한다.
4. **(선택)** 광고회사 계획서 후속 — 사전 과제용 OS별 설치 가이드 1장, 사례 2~5용 배포 자료(설정 파일·스크립트·템플릿 repo). 계획서가 "배포" 전제로 쓰였는데 아직 없음.

## Blockers

- 없음 (Next Steps 1·3은 사용자 결정 대기, 차단은 아님)

## Watch Out

- ⚠️ **이 repo는 PUBLIC이다.** 커밋 전 민감 파일 여부를 항상 확인. `git ls-files <경로>` 출력이 비어야 차단된 것.
- ⚠️ **`docs/references/` xlsx는 미익명화 실 계정 데이터다.** `tests/fixtures/anonymized/`가 그 익명화 파생본이며 둘은 다른 파일. `anonymized` 테스트 이름을 보고 `docs/references/` 파일이 익명화됐다고 오판한 전례가 이 세션에 있었다 — 반복 금지.
- **강의 교안은 이 repo에 없다.** 현재 위치 `/Users/hoshin/workspace/SHC/shconsulting/docs/ax-lecture/` — `zb-lecture-plan-1-7.md`, `adagency-lecture-plan-1-2.md`, `zb-lecture-playground.html`, `20260616_claude-ax-통합교안_범용.html`. 교안 편집·추가는 그 repo에서.
- **`docs/references/` 4개는 이동·개명 금지.** xlsx는 `tests/e2e-reference-parity.test.ts:135` 하드코딩(옮기면 테스트 즉시 실패), html은 `src/dashboard/artifact-html.ts:2`·`src/analyzer/weekly-prompt.ts:8` 주석만(옮기면 **테스트는 통과하고 경로만 조용히 썩는다**).
- **shconsulting repo는 로컬이 자주 뒤처진다.** 작업 전 `git -C /Users/hoshin/workspace/SHC/shconsulting pull --rebase origin main`.
- `.gitignore` 패턴 중간에 슬래시가 있으면 루트 앵커여서 하위 디렉터리를 못 잡는다 → `**/` prefix 필요. 반대로 앵커 없는 `dirname/`은 과도 매칭.
- **문서를 근거로 판단하기 전에 실제 상태를 확인하라.** 이 세션에서 `docs/SECURITY.md`·exec-plans의 ignore 관련 서술이 광범위하게 현실과 어긋나 있음이 드러났다.
- 광고회사 계획서 성공 판정 지표는 하나 — **주간 리포트 html+xlsx를 자기 손으로 만든 수강생 비율 80%**. 미달이면 사전 과제 관리 실패이고 시연 4개는 무의미.

## Files Touched

- `docs/SECURITY.md` — 109행 정정 (`65b65e4`)
- `.gitignore` — `**/.omc/state/` 계열 4줄 추가 (`45eec3c`)
- `docs/references/zb-lecture-plan-1-7.md` — 삭제 (-520줄, shconsulting 이관)
- `.claude-project/memory/` — 신규 4건(`docs-references-inventory`, `asset-move-grep-code-comments`, `shconsulting-repo-behind-remote`, `claudeignore-vs-gitignore-scope`) + 갱신 1건(`gitignore-dirname-anchor`) + `MEMORY.md` 인덱스. `docs-references-inventory`는 허위 서술 정정 포함
- (타 repo) `shconsulting/docs/ax-lecture/` — 교안 3종 추가 (`ed0b03d`)
