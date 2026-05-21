---
name: mcp-server-cwd-pitfall
description: Claude Desktop이 MCP 서버 spawn 시 cwd="/" → path.resolve(process.cwd(), "x") 의도와 다르게 root 절대경로 됨
type: reference
created: 2026-05-21
---

Claude Desktop이 MCP 서버 process spawn 시 working directory를 "/"(root)로 설정. 코드가 `process.cwd()` 가정에 기반해 default path 계산하면 시스템 루트 절대경로 됨 → mkdir EACCES/ENOENT.

**증거** (commit ea02abd, Desktop log):

```
ENOENT: no such file or directory, mkdir '/reports'
```

서버 코드: `path.resolve(process.cwd(), "reports")` = "/reports".

**해결 패턴** (src/cli.ts):

```ts
function resolveProjectRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // src/cli.ts → 부모, dist/cli.js → 부모 (둘 다 project root)
  return path.resolve(here, "..");
}
const PROJECT_ROOT = resolveProjectRoot();
const REPORTS_BASE_DIR =
  process.env.NAVER_ADS_REPORTS_DIR ?? path.join(PROJECT_ROOT, "reports");
```

추가로 server.ts 내부 fallback default도 `process.cwd()` 의존 제거 → `os.homedir()/naver-ads-mcp-reports`.

**Why:** Desktop이 어떤 cwd로 spawn하는지 host에 따라 다름 (`/`, app dir 등). 코드는 spawn cwd를 신뢰하면 안 됨.

**How to apply:** MCP 서버는 (1) `import.meta.url` 또는 `__dirname`으로 script 위치 기준 path 계산 (2) ENV variable override 지원 (3) 마지막 fallback은 `os.homedir()` 절대 안전 경로. **`process.cwd()`는 절대 default path 계산에 쓰지 말 것**.

관련: [[mcp-deployment-local-path]], [[reports-path-convention]].
