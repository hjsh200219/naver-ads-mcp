---
name: github-repo
description: GitHub repo 위치 + visibility + 주요 commits
type: reference
created: 2026-05-08
---

# Repository

- URL: https://github.com/hjsh200219/naver-ads-mcp
- Visibility: **PRIVATE**
- Owner: `hjsh200219` (개인 계정)
- Default branch: `main`

# 주요 Commits (시간순)

1. `40f1d5b` — chore: bootstrap naver-ads-mcp server (153 tests, 12 user stories)
2. `5a369d9` — chore: harness engineering setup (5-agent pipeline, AGENTS.md/ARCHITECTURE/.claudeignore/eslint/knip/husky)
3. `f2e1f6e` — chore: harness GC #1 — baseline L4 (82.26점)

# Excluded from repo

- `.env` (.gitignore)
- `docs/references/1778140340186_(FORM) helloMAX Report_신청완료.xlsx` (실 광고주 데이터, 1.3MB — local-only)
- `_workspace/` (harness 임시 디렉토리)
- `.omc/state/` (OMC session state)

# Clone for new machine

```bash
git clone git@github.com:hjsh200219/naver-ads-mcp.git
cd naver-ads-mcp
cp .env.example .env  # 그리고 키 3종 입력
npm install
npm run build
npm test     # 153 passing
```

**Why:** 다른 PC에서 이어받기 / 새 협업자 온보딩 시 즉시 위치 확인 가능.

**How to apply:** repo 위치를 잊었을 때 즉시 참조. Push 시점이나 commit hash 기준으로 변경 이력 추적 가능.
