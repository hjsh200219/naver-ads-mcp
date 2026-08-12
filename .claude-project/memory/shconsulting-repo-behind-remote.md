---
name: shconsulting-repo-behind-remote
description: SHC/shconsulting repo는 로컬이 원격보다 자주 뒤처져 push가 non-fast-forward로 실패한다 — 작업 전 pull --rebase
type: reference
created: 2026-08-13
---

`/Users/hoshin/workspace/SHC/shconsulting` (github.com/hjsh200219/shconsulting)은 다른 환경에서도 활발히 커밋되는 repo다. 2026-08-13 강의 교안 이관 시 로컬 클론이 원격보다 **30+ 커밋 뒤처져** 있어 push가 non-fast-forward로 거부됐다. `pull --rebase` 후 재푸시로 해소 (커밋 `ed0b03d`).

강의 교안이 이 repo의 `docs/ax-lecture/`로 이동했으므로([[docs-references-inventory]]) 교안 작업 시 매번 이 경로를 건드린다.

**Why:** 커밋까지 다 끝낸 뒤 push 단계에서 막혀 되돌리는 낭비가 반복된다. 이 repo는 발행·예약 자동화가 원격에서 커밋을 쌓는 구조여서 로컬이 뒤처지는 게 기본 상태에 가깝다.

**How to apply:**

- shconsulting에서 작업 **시작 전** `git -C /Users/hoshin/workspace/SHC/shconsulting pull --rebase origin main` 먼저 실행.
- push 실패 시 `--force` 금지. `pull --rebase`로 해소한다 (원격에 다른 환경의 작업이 살아 있다).
- 관련: [[gitignore-dirname-anchor]] — 이 repo는 `.gitignore`에 `.omc/`가 전체 무시로 등록되어 있어 naver-ads-mcp와 패턴이 다르다.
