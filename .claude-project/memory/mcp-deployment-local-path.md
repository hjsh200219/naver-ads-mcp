---
name: mcp-deployment-local-path
description: MCP 배포는 로컬 경로 유지 (npx + GitHub install 거부됨)
type: project
created: 2026-05-08
---

본 MCP는 npx + GitHub install이 아닌 로컬 빌드 경로 직접 참조 방식으로 운영한다.

**Why:** 사용자 결정. 로컬 개발/디버깅 사이클이 빠르고, 자격증명 파일(`accounts.json`) 위치 통제가 쉬움. 매 실행 시 git clone + build 비용도 회피.

**How to apply:** Claude Desktop config는 `command: "npx"`, `args: ["tsx", "<absolute-path>/src/cli.ts"]` 또는 `command: "node"`, `args: ["<absolute-path>/dist/cli.js"]` 형태 유지. **`cwd` 필드는 일부 환경에서 무시되므로 의존 금지** — `accounts.json` 위치는 반드시 `env.NAVER_ADS_ACCOUNTS_PATH` 절대경로로 명시. 배포 방식 변경(npm publish, github install 등) 제안 전 사용자 명시적 확인 필수.
