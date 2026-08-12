---
name: claudeignore-vs-gitignore-scope
description: .claudeignore 등록은 git 노출을 전혀 막지 못한다 — 미익명화 실 계정 xlsx가 PUBLIC repo에 push된 실제 사례
type: reference
created: 2026-08-13
---

`.claudeignore`는 **에이전트 열람 차단**, `.gitignore`는 **커밋·push 차단**으로 목적이 다르고 서로 상속하지 않는다.

**실제 사고 (2026-08-13 발견, 미해결)**: `docs/references/`는 `.claudeignore:30`에만 등록되고 `.gitignore`에는 없어서, 미익명화 실 계정 xlsx 등 4개 파일이 git 추적 + `origin/main` push 상태다. 이 repo는 `PUBLIC`이다 (`gh repo view hjsh200219/naver-ads-mcp --json visibility` → `PUBLIC`). 노출 내용: 캠페인명 `헬로맥스AI에이전트#파워링크#PC`, 일별 광고비 181행(12080·29420·17490·19980). 반대로 `_workspace/`는 양쪽(`.gitignore:46`, `.claudeignore:27`) 등록되어 정확하다.

**제거 경로 3단계** (난이도 상승 순):

| 단계 | 작업                                                                              | 난이도 | 효과                     |
| ---- | --------------------------------------------------------------------------------- | ------ | ------------------------ |
| 1    | `tests/e2e-reference-parity.test.ts:130-136`의 `REF_PATH`를 익명화 fixture로 이전 | 중     | untrack의 선행 조건 해제 |
| 2    | `docs/references/`를 `.gitignore` 등록 + `git rm --cached`                        | 낮음   | 앞으로 추적 안 됨        |
| 3    | git history 재작성(filter-repo 등) + 강제 push                                    | 높음   | 기존 이력에서 제거       |

1·2단계만으로는 **이미 push된 이력이 남는다.** PUBLIC repo이므로 3단계 없이는 노출이 계속된다.

**Why:** "에이전트가 못 보니 안전하다"는 착각이 실 계정 데이터를 공개 저장소에 남긴 직접 원인이었다. 같은 착각은 다음 민감 경로에서 반복된다. 문서(`docs/SECURITY.md:109`)도 오래 `.gitignore` 등록이라 잘못 적혀 있어 아무도 실제 상태를 확인하지 않았다 — commit `65b65e4`에서 정정.

**How to apply:**

- 민감 경로는 **두 파일 모두**에 등록한다. 한쪽만으로는 다른 쪽이 열려 있다.
- 등록 후 `git ls-files <경로>`로 확인한다. **출력이 비어야 비로소 차단된 것이다.** `.gitignore` 추가만으로는 이미 추적 중인 파일이 빠지지 않는다(`git rm --cached` 필요).
- 코드·테스트가 그 경로를 읽고 있으면 대체 경로 이전이 선행 조건이다. [[asset-move-grep-code-comments]] 절차로 참조를 먼저 찾는다.
- 관련: [[docs-references-inventory]] (해당 4개 파일의 정체·참조 관계)
