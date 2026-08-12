---
name: docs-references-inventory
description: docs/references/ 잔존 4개 파일의 정체와 참조 관계 — 강의 교안은 shconsulting으로 떠났고 남은 4개는 이동 금지
type: project
created: 2026-08-13
---

**강의 교안 3종은 이 repo에 없다.** 2026-08-13에 `/Users/hoshin/workspace/SHC/shconsulting/docs/ax-lecture/` 로 이동됨 (naver-ads-mcp commit `45eec3c` 삭제 / shconsulting commit `ed0b03d` 추가):

- `zb-lecture-plan-1-7.md` — Humax AX 7회차 계획서
- `adagency-lecture-plan-1-2.md` — 광고회사 2회차 사례 중심 계획서
- `zb-lecture-playground.html` — 강의 계획 튜너
- (같은 폴더 기존 자산: `20260616_claude-ax-통합교안_범용.html`)

**`docs/references/`에 남은 4개는 교안이 아니며 이동·개명 금지**:

| 파일                                                 | 성격                             | 참조하는 곳                                                                                               |
| ---------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `1778140340186_(FORM) helloMAX Report_신청완료.xlsx` | **실 계정 form 원본 (미익명화)** | **`tests/e2e-reference-parity.test.ts:135` 파일명 하드코딩** (parity 기준) + `src/excel/styles.ts:2` 주석 |
| `hellomax_weekly_comment_sample.html`                | 주간 코멘트 샘플                 | `src/dashboard/artifact-html.ts:2`, `src/analyzer/weekly-prompt.ts:8` (주석)                              |
| `(사업) 광고운영부서 업무 Workflow 작성_260429.docx` | helloMAX 사업 문서               | 광고운영 STEP·소요시간·Pain Point 원천 — 광고회사 강의 사례의 근거                                        |
| `HelloMax_주간리포트_AI코멘트_기획안_v2.0.docx`      | 기획안                           | —                                                                                                         |

> ⚠️ **이 xlsx는 익명화되지 않았다.** 2026-08-13 exceljs 직접 대조로 확인: `키워드RAW` 14,702행의 캠페인명이 `헬로맥스AI에이전트#파워링크#PC`(실 계정명), `일별RAW` 181행에 실 광고비(12080·29420·17490·19980). 익명화본은 **별도로** `tests/fixtures/anonymized/client-a-form.xlsx`이며(행수 14,702 동일, 캠페인명만 `ClientA#…`로 치환, 키워드는 원본과 동일해 완전 익명화 아님), `anonymized` 테스트 스위트는 전부 이 fixture만 읽는다.
>
> **이 파일을 "익명화됨"으로 취급해 gitignore 해제·공개 이동을 정당화하지 말 것.** 앞선 세션이 `tests/excel-template.test.ts:21`의 테스트 이름(`anonymized form file`)을 이 파일에 잘못 귀속시켜 memory에 "익명화된 form 원본"이라 기록한 전례가 있다.
>
> **미해결**: 이 repo는 `PUBLIC`이고(`gh repo view` 확인) 4개 파일이 git 추적 + `origin/main` push 상태다. 상세·제거 경로는 [[claudeignore-vs-gitignore-scope]].

**Why:** "docs/references는 강의 자료 폴더"라 오인해 남은 파일까지 옮기면 xlsx는 테스트가 즉시 깨지고, html은 코드 주석 경로만 조용히 썩는다. 4개 모두 git 추적 중이므로 이동은 곧 커밋 변경이다.

**How to apply:**

- 강의 교안 편집·추가는 `shconsulting/docs/ax-lecture/`에서 한다. 이 repo에 새 교안을 만들지 않는다.
- `docs/references/` 4개는 읽기 전용 참조 자산으로 취급. 이동 필요가 생기면 [[asset-move-grep-code-comments]] 절차를 먼저 밟는다.
- 광고운영 업무 사례가 필요하면 `(사업) 광고운영부서 업무 Workflow` docx가 원천이다 (STEP 번호·평균 소요시간·Pain Point·자동화 가능 여부 표 포함).
