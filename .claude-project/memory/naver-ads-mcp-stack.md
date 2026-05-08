---
name: naver-ads-mcp-stack
description: naver-ads-mcp 프로젝트의 핵심 스택과 절대 변경 금지 규약
type: project
created: 2026-05-08
---

# 핵심 스택

- **Runtime**: Node.js 20+, TypeScript 5 (strict, NodeNext, ES2022)
- **MCP**: `@modelcontextprotocol/sdk` v1.x (stdio transport)
- **Excel**: `exceljs`
- **Validation**: `zod`
- **Test**: `vitest` (153 tests passing baseline)
- **Lint**: `eslint` v9.39.4 (v10 incompatible with eslint-plugin-import@2.32.0)
- **Dead code**: `knip --strict` (integrated in `npm run gc`)

# Critical Constraints

1. `.env`는 절대 commit 금지. `.gitignore` 등록 완료.
2. `accessLicense`/`secretKey` 필드는 `enumerable: false`로 비누출.
3. HMAC payload는 `${ts}.${METHOD}.${path}` (path-only, query string 제외).
4. SECRET_KEY는 헤더 미전송 (서명 생성 전용).
5. 브랜드검색 영역별 성과 시트는 항상 hidden placeholder. Naver API 미지원 (Issue #1072).
6. `as any`, `@ts-ignore`, eslint-disable 사용 금지 (현재 0건 유지).

# Layer Structure (5 layers)

L1 Runtime (`mcp/server.ts`, `cli.ts`, `index.ts`) → L2 Service (`raw/`, `pivot/`, `excel/`, `util/`) → L3 API (`api/{client,signer,stat-reports,metadata}.ts`) → L4 Config (`config/credentials.ts`) → L5 Types (`api/types.ts`, `pivot/types.ts`)

ESLint 21 zones로 자동 강제 (eslint.config.mjs).

**Why:** 이 제약들은 보안·합법성(ToS)·재현성을 동시에 만족시키는 의도적 설계. 새 기능 추가 시 깨지지 않도록 우선 검증.

**How to apply:** 새 코드 추가 시 (1) `.env` 패턴 점검 (2) 자격증명이 로그/에러에 노출되는지 grep (3) HMAC 사용 시 path-only 보장 (4) 새 export는 import 방향(L1 ← L2 ← L3 ← L4 ← L5) 준수.
