---
name: eslint-tests-no-inline-disable
description: tests/**.ts에서는 @typescript-eslint/* 인라인 disable 사용 금지
type: project
created: 2026-05-08
---

테스트 파일에서 `// eslint-disable-next-line @typescript-eslint/no-explicit-any` 같은 인라인 disable 주석을 사용하면 안 된다.

**Why:** `eslint.config.mjs`가 `tests/**/*.ts` 영역에 `@typescript-eslint` 플러그인을 등록하지 않음. 따라서 해당 룰을 가리키는 인라인 disable 주석은 "Definition for rule '...' was not found" 에러를 발생시켜 lint-staged pre-commit hook이 차단함.

**How to apply:** 테스트 코드에서 `any` 회피가 필요하면 disable 주석 대신 정확한 타입(`unknown`, `Record<string, unknown>`, generics, type assertion via known interface)으로 작성. MCP `Server` 내부 핸들러 호출 등 라이브러리 타입을 좁혀야 할 때는 보조 타입(예: `type ServerWithHandlers = Server & { _requestHandlers: Map<...> }`) 정의 후 단일 위치에서 cast. tests/에 typescript-eslint 룰을 추가해야 한다면 `eslint.config.mjs`의 tests zone(`files: ["tests/**/*.ts"]`)에 plugin 등록을 먼저 갱신.
