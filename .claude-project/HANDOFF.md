---
created: 2026-08-13T00:25:32+09:00
project: naver-ads-mcp
summary: 광고회사용 2회차 사례 중심 강의 계획서 신규 작성 후, 강의 교안 3종을 shconsulting/docs/ax-lecture로 이관. docs/references/ 잔존 4개는 코드·테스트 의존으로 이동 제외. 45eec3c / ed0b03d. 문서 전용.
---

## Session Digest

문서 전용 세션, 3단계로 진행. (1) 기존 `zb-lecture-plan-1-7.md`(Humax AX 7회차, 520줄) 확인. (2) 광고회사 대상 2회차 강의 계획서 `adagency-lecture-plan-1-2.md`(340줄) 신규 작성 — 1회차는 기존 모듈 1-1~1-4 그대로 유지하고 기존 2~7회차를 업무 사례 5개로 재편. (3) 강의 교안 3종을 `shconsulting/docs/ax-lecture/`로 이관하고 원본 삭제. `docs/references/` 잔존 4개는 코드·테스트가 참조해 이동 제외.

코드 변경 없음. lint 0 / typecheck 0 / test 359 passing / build 통과.

## Progress

- ✅ `adagency-lecture-plan-1-2.md` 신규 작성 (340줄). 2회차 = 사례 5개, 핸즈온 1개(사례 1 주간 리포트) + 시연 4개. 설치 7개는 사전 과제로 강의 밖 이관
- ✅ 사례 근거를 `(사업) 광고운영부서 업무 Workflow 작성_260429.docx`의 STEP 번호·평균 소요시간·Pain Point에서 도출 (가상 예제 아님)
- ✅ 원본 7회차 → 2회차 커버리지 표 작성. 삭제 8개 명시(OMC, CCG, TDD, 하네스/CLAUDE.md, 재배포 디버깅, OAuth, Google Cloud Console, gstack)
- ✅ 교안 3종 이관: `shconsulting/docs/ax-lecture/` (commit `ed0b03d`, rebase 후 push)
- ✅ 원본 삭제 + `.gitignore` OMC state 패턴 보강 (commit `45eec3c`)
- ✅ 양쪽 repo `origin/main` 동기 완료
- ⬜ `(사업) 광고운영부서 업무 Workflow.docx` 교안 폴더 이관 여부 — 사용자 미결정
- ⬜ `docs/SECURITY.md:109` 서술 부정확 — 미조치 (아래 Next Steps 2번)

## Next Steps

1. **(사용자 결정 대기)** `(사업) 광고운영부서 업무 Workflow 작성_260429.docx`를 교안 폴더로 옮길지. 현재 naver-ads-mcp에 유지 중 — 강의 사례 근거이면서 helloMAX 사업 문서라 양쪽 성격을 겸한다.
2. **(사용자 결정 대기)** `docs/SECURITY.md:109`가 `docs/references/`를 "`.gitignore` + `.claudeignore` 등록"이라 서술하지만 **실제로는 4개 파일 모두 git 추적 중**이다 (`git check-ignore` 미매치, `git ls-files docs/references/` 4건 반환). 선택지: (a) 문서 서술을 현실에 맞게 수정, (b) 파일을 untrack. 단 xlsx는 테스트가 읽으므로 untrack하면 CI에서 테스트 불가 — 문서 수정이 현실적.
3. **(선택)** `CLAUDE.md` Critical Constraints에 "`docs/references/` 코드·테스트 참조 자산 2건 이동·개명 금지" 추가 검토. 이번 세션에 실제 이동 후보로 검토됐던 near-miss.
4. **(선택)** 광고회사 계획서 후속 — 사전 과제용 OS별 설치 가이드 1장, 사례 2~5용 배포 자료(설정 파일·스크립트·템플릿 repo)가 계획서상 "배포" 전제인데 아직 없음.

## Blockers

- 없음

## Watch Out

- **강의 교안은 이 repo에 없다.** 현재 위치: `/Users/hoshin/workspace/SHC/shconsulting/docs/ax-lecture/`
  - `zb-lecture-plan-1-7.md` (Humax AX 7회차), `adagency-lecture-plan-1-2.md` (광고회사 2회차), `zb-lecture-playground.html` (계획 튜너), `20260616_claude-ax-통합교안_범용.html` (기존)
  - 교안 편집·추가는 그 repo에서. 이 repo에 새 교안 만들지 말 것.
- **`docs/references/` 4개는 이동·개명 금지.** "강의 자료 폴더"로 오인하기 쉬움:
  - `1778140340186_(FORM) helloMAX Report_신청완료.xlsx` ← **`tests/e2e-reference-parity.test.ts:135` 파일명 하드코딩** (옮기면 테스트 즉시 실패) + `src/excel/styles.ts:2` 주석
  - `hellomax_weekly_comment_sample.html` ← `src/dashboard/artifact-html.ts:2`, `src/analyzer/weekly-prompt.ts:8` (주석만 — 옮기면 **테스트는 통과하고 경로만 조용히 썩는다**)
  - `(사업) 광고운영부서 업무 Workflow.docx`, `HelloMax_주간리포트_AI코멘트_기획안_v2.0.docx` — 사업 문서
- **shconsulting repo는 로컬이 원격보다 자주 뒤처진다.** 이번에 30+ 커밋 뒤처져 push가 non-fast-forward 거부됨. 작업 시작 전 `git -C /Users/hoshin/workspace/SHC/shconsulting pull --rebase origin main`.
- `.gitignore`의 `.omc/state/`처럼 **패턴 중간에 슬래시가 있으면 루트 앵커**여서 하위 디렉터리를 못 잡는다. `**/` prefix 필요. (`.omc/skills/**`는 committable 예외라 전체 무시 안 함)
- 광고회사 계획서의 성공 판정 지표는 하나로 잡았다 — **주간 리포트 html+xlsx를 자기 손으로 만든 수강생 비율 80%**. 미달이면 사전 과제 관리 실패이고 시연 4개는 무의미.

## Files Touched

- `.gitignore` — `**/.omc/state/` 계열 4줄 추가 (`docs/references/.omc/` untracked 노출 해소)
- `docs/references/zb-lecture-plan-1-7.md` — 삭제 (-520줄, shconsulting으로 이관)
- `.claude-project/memory/` — 신규 3건(`docs-references-inventory`, `asset-move-grep-code-comments`, `shconsulting-repo-behind-remote`) + 갱신 1건(`gitignore-dirname-anchor` 과소 매칭 함정 추가) + `MEMORY.md` 인덱스
- (타 repo) `shconsulting/docs/ax-lecture/` — 교안 3종 추가
