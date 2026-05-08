# Layer Rules

## Allowed Edges (Direction: top → bottom)

| From                                                                             | May import                                                        | Forbidden             |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------- |
| L1 (`src/cli.ts`, `src/mcp/`, `src/runtime/`, `src/index.ts`)                    | All other layers + `node:fs`, `node:path`, `node:os`              | None internal         |
| L2 (`src/raw/`, `src/pivot/`, `src/excel/`, `src/util/`)                         | L3 (api/types.ts only for raw/pivot), L4 (config — util 제외), L5 | L1 (no upward import) |
| L3 (`src/api/`)                                                                  | L4 (config), L5                                                   | L1, L2                |
| L4 (`src/config/`)                                                               | L5 only                                                           | L1, L2, L3            |
| L5 (`src/api/types.ts`, `src/pivot/types.ts`, `src/raw/builder.ts` — interfaces) | None internal                                                     | All                   |

### 세부 허용 엣지

```
src/cli.ts          → src/mcp/server, src/runtime/*
src/mcp/*           → all layers below (L2, L3, L4, L5)
src/runtime/*       → src/config/* + node:fs, node:path  (file/env IO 전용 L1 helper)
src/index.ts        → all layers below

src/raw/*           → src/api/types.ts (INaverAdsClient 인터페이스만), src/util/
src/pivot/*         → src/raw/builder.ts (타입만), src/pivot/types.ts
src/excel/*         → src/raw/builder.ts (타입), src/pivot/types.ts
src/util/*          → (없음) — 순수 함수만, 도메인 의존성 0

src/api/client.ts   → src/api/types.ts, src/api/signer.ts, src/config/credentials.ts
src/api/signer.ts   → src/config/credentials.ts
src/api/stat-reports.ts → src/api/client.ts, src/api/types.ts
src/api/metadata.ts → src/api/client.ts, src/api/types.ts

src/config/*        → (없음) — 환경변수만 의존

src/api/types.ts    → (없음) — no internal imports
src/pivot/types.ts  → (없음) — no internal imports
src/raw/builder.ts  → (없음) — interface 정의만
```

## Same-layer Imports

허용. 단 순환 참조는 금지.

예: `src/api/stat-reports.ts` → `src/api/client.ts` 는 동일 L3 내부 참조로 허용.

## Forbidden Patterns

1. **raw/pivot → api/client 직접 import 금지**: `src/raw/`나 `src/pivot/`에서 `src/api/client.ts` 직접 import 금지. `INaverAdsClient` 인터페이스(`src/api/types.ts`)만 import.
2. **credentials 노출 금지**: `src/api/`에서 자격증명을 `console.log` / `JSON.stringify`에 노출 금지.
3. **util 도메인 의존성 0**: `src/util/`은 순수 함수만. `src/api/`, `src/raw/`, `src/pivot/`, `src/excel/`, `src/mcp/`, `src/config/` 어떤 것도 import 금지.
4. **excel 의존성 제한**: `src/excel/`은 `src/raw/builder.ts` 타입과 `src/pivot/types.ts`만 의존. API / config / mcp import 금지.
5. **config 하위 의존 금지**: `src/config/`는 환경변수만 읽음. `src/api/`, `src/raw/`, `src/pivot/`, `src/excel/`, `src/mcp/` 모두 금지.
6. **L5 타입 파일 내부 import 금지**: `src/api/types.ts`, `src/pivot/types.ts`, `src/raw/builder.ts`는 `src/` 내부 어떤 모듈도 import 금지.
7. **역방향(upward) import 금지**: L2에서 L1 (`src/mcp/`, `src/cli.ts`) import 금지.

## Lint Enforcement

ESLint `import/no-restricted-paths` 규칙으로 자동 강제. 위반 시 한글 에러 메시지 표시.

설정 파일: `eslint.config.mjs`

강제되는 주요 zone:

- `target: src/config` — `from: src/api, src/raw, src/pivot, src/excel, src/mcp` 각각 금지
- `target: src/raw` — `from: src/api/client.ts` 금지 (인터페이스만 허용), `from: src/mcp` 금지
- `target: src/pivot` — `from: src/api/client.ts, src/mcp` 금지
- `target: src/excel` — `from: src/api, src/mcp, src/config` 금지
- `target: src/util` — `from: src/api, src/raw, src/pivot, src/excel, src/mcp, src/config` 금지
- `target: src/api/types.ts` — `from: src/api/client.ts, src/api/signer.ts, src/config` 금지

## Layer Violation 예시 (위반 사례)

```typescript
// BAD: raw/daily.ts에서 api/client 직접 import
import { NaverAdsClient } from "../api/client"; // ❌ ESLint 오류

// GOOD: 인터페이스만 import
import type { INaverAdsClient } from "../api/types"; // ✅

// BAD: config에서 api import
import { NaverAdsClient } from "../api/client"; // src/config/*.ts에서 ❌

// BAD: util에서 도메인 코드 import
import { buildRawRow } from "../raw/daily"; // src/util/*.ts에서 ❌

// BAD: excel에서 api 직접 사용
import { NaverAdsClient } from "../api/client"; // src/excel/*.ts에서 ❌
```
