---
name: gitignore-dirname-anchor
description: .gitignore 앵커 규칙은 양방향 함정 — 앵커 없는 dirname/은 과도 매칭(output/ 사례), 중간 슬래시 패턴은 과소 매칭(.omc/state/ 사례)
type: project
created: 2026-05-11
---

**함정 A — 과도 매칭 (v1.6 커밋 30c5738)**: `.gitignore`에 `output/`(앵커 없음)를 추가하자 `src/output/` 내 파일 3개(weekly-html, weekly-xlsx, file-writer)가 git이 추적을 거부해 커밋에서 누락됐다. 세션은 "v1.6 출하 완료"로 종료됐지만 다음 세션에서 파일이 없다는 것을 발견. `/output/`(슬래시 앵커)로 수정해 해결.

**함정 B — 과소 매칭 (2026-08-13 커밋 45eec3c)**: 정반대 방향의 실패. 패턴 **중간에** 슬래시가 있는 `.omc/state/`는 repo 루트 앵커로 해석되어 `docs/references/.omc/state/` 같은 하위 경로를 전혀 커버하지 못했다. OMC 세션 상태 파일이 untracked로 노출되어 `git add -A`에 섞일 위험. `**/.omc/state/`, `**/.omc/sessions/`, `**/.omc/logs/`, `**/.omc/research/`를 추가해 해소 (`.gitignore` 25-29행. `.omc/skills/**`는 committable 예외이므로 전체 무시하지 않았다).

**Why:** Git 패턴 매칭에서 **슬래시 위치가 앵커를 결정한다**. 패턴에 슬래시가 없거나 맨 끝에만 있으면(`output/`) 모든 깊이에 매칭 — 과도 매칭. 패턴 중간에 슬래시가 있으면(`.omc/state/`) 루트 기준 앵커 — 과소 매칭. 한쪽 함정만 기억하면 반대쪽에서 다시 걸린다.

**How to apply:**

- `.gitignore`에 디렉터리 이름을 추가할 때는 의도가 "repo 루트의 해당 디렉터리만 제외"라면 반드시 `/dirname/`으로 앵커.
- 같은 이름의 디렉터리가 소스 트리 안에 존재할 가능성이 조금이라도 있으면 앵커 필수.
- 새 .gitignore 항목 추가 후 `git status`로 예상치 못한 파일이 untracked/ignored 되지 않는지 즉시 확인.
- 세션 종료 전 `git status --short`로 "신규 파일이 staging에 올라갔는가"를 명시적으로 점검하는 루틴 권장.
