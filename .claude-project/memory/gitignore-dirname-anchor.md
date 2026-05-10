---
name: gitignore-dirname-anchor
description: .gitignore의 앵커 없는 dirname/ 패턴은 하위 디렉터리도 삼킨다 — output/ 실수로 src/output/ 전체가 커밋 누락된 사례
type: project
created: 2026-05-11
---

**v1.6 커밋 30c5738에서 발생한 실제 foot-gun**: `.gitignore`에 `output/`(앵커 없음)를 추가하자 `src/output/` 내 파일 3개(weekly-html, weekly-xlsx, file-writer)가 git이 추적을 거부해 커밋에서 누락됐다. 세션은 "v1.6 출하 완료"로 종료됐지만 다음 세션에서 파일이 없다는 것을 발견. `/output/`(슬래시 앵커)로 수정해 해결.

**Why:** Git의 `.gitignore` 패턴 매칭에서 선행 슬래시 없는 `dirname/`은 repo 내 모든 깊이의 `dirname/`에 매칭된다. 선행 슬래시가 있으면 repo 루트 기준 앵커가 된다.

**How to apply:**

- `.gitignore`에 디렉터리 이름을 추가할 때는 의도가 "repo 루트의 해당 디렉터리만 제외"라면 반드시 `/dirname/`으로 앵커.
- 같은 이름의 디렉터리가 소스 트리 안에 존재할 가능성이 조금이라도 있으면 앵커 필수.
- 새 .gitignore 항목 추가 후 `git status`로 예상치 못한 파일이 untracked/ignored 되지 않는지 즉시 확인.
- 세션 종료 전 `git status --short`로 "신규 파일이 staging에 올라갔는가"를 명시적으로 점검하는 루틴 권장.
