---
name: caller-sandbox-vs-host-paths
description: MCP caller(LLM) sandbox 경로(/home/claude, /mnt/user-data)와 MCP server host 경로는 격리 — outputPath 인자에 caller 경로 금지
type: reference
created: 2026-05-21
---

MCP 호출 측 LLM(Claude Desktop, Claude.ai)은 자체 sandbox 환경에서 동작. 그 LLM이 인식하는 파일 경로(`/home/claude/foo.xlsx`, `/mnt/user-data/outputs/...`)는 **MCP server host 머신에 존재하지 않음**.

**증거** (commit 23e59e7, Desktop log):

- `generate_report({outputPath:"/home/claude/x.xlsx"})` → `ENOENT: no such file or directory, mkdir '/home/claude'`
- `generate_report({outputPath:"/mnt/user-data/outputs/r.xlsx"})` → 동일 fail

**대응**:

1. tool description에 "outputPath = MCP server host 절대경로. caller sandbox 금지" 명시
2. outputPath optional + default = host-side `./reports/<account>/<file>.xlsx`
3. caller가 결과 파일을 보려면: return된 `xlsx_path`는 host 경로 — caller가 직접 읽을 수 없음. AE가 host 머신 Finder/Explorer로 열거나 별도 transport 필요

**Why:** Desktop LLM은 자기 sandbox만 인식. MCP는 host에서 실행. 둘 사이 file system 격리 명시 안 하면 LLM이 자기 sandbox 경로 무심코 전달 → fail.

**How to apply:** 파일 출력 tool은 (1) 가능하면 outputPath optional (host default 사용) (2) description에 sandbox 차이 명시 (3) 출력 경로 안내는 host 경로임을 표시.

관련: [[mcp-server-cwd-pitfall]], [[reports-path-convention]], [[mcp-1mb-response-limit]].
