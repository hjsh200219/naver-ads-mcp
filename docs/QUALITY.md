# Quality Standards — Naver Ads MCP

## 품질 기준 요약

| 항목       | 기준                       | 현황     |
| ---------- | -------------------------- | -------- |
| TypeScript | strict=true, 0 errors      | ✓        |
| 테스트     | vitest 153 passing         | ✓        |
| 빌드       | tsc → dist/ 에러 없음      | ✓        |
| ESLint     | 레이어 강제 (Phase 3 예정) | △ 미설정 |

## TDD 원칙

모든 새 기능은 **실패하는 테스트 먼저 작성**.

```
1. 실패하는 테스트 작성 (red)
2. 최소한의 코드로 통과 (green)
3. 리팩토링 (refactor)
```

- 외부 API 호출은 반드시 mock으로 격리 (live 호출 금지)
- credentials-required 테스트는 별도 marker로 분리

## 코드 구조 규칙

### 함수 크기

- **함수 50줄 이하**
- **매개변수 4개 이하** (초과 시 options 객체로 묶기)
- **중첩 3단계 이내** (early return 패턴 활용)

### Early Return 우선

```typescript
// 금지 (깊은 중첩)
function process(data: Data | null) {
  if (data) {
    if (data.items) {
      return data.items.map(...);
    }
  }
}

// 권장 (early return)
function process(data: Data | null) {
  if (!data) return [];
  if (!data.items) return [];
  return data.items.map(...);
}
```

### 에러 처리

- **try-catch에서 에러 삼키지 않기**: catch 블록에서 반드시 re-throw 또는 명시적 처리
- `NaverAdsApiError`를 활용하여 HTTP status 보존

```typescript
// 금지
try {
  await client.get(path);
} catch {
  // silent fail
}

// 권장
try {
  await client.get(path);
} catch (err) {
  throw new NaverAdsApiError(`요청 실패: ${path}`, { cause: err });
}
```

### Import 방향

```
L1 (Runtime) ← L2 (Service) ← L3 (API) ← L4 (Config) ← L5 (Types)
```

역방향 import 금지. 위반 시 빌드/lint 실패.

### 매직 넘버 금지

```typescript
// 금지
await sleep(3000);
if (retries > 3) throw ...;

// 권장
const INITIAL_POLL_DELAY_MS = 1_000;
const MAX_RETRIES = 3;
```

## 검증 명령

```bash
npm run typecheck   # TypeScript 검증 (0 errors 목표)
npm test            # vitest run (all passing 목표)
npm run build       # tsc → dist/ (에러 없음 목표)
```

## 테스트 파일 구조

```
tests/
├── api/          # L3 API 테스트 (client, signer, stat-reports, metadata)
├── raw/          # L2 RAW 변환 테스트
├── pivot/        # L2 Pivot 집계 테스트
├── excel/        # L2 Excel 생성 테스트
├── util/         # L2 날짜 유틸 테스트
└── mcp/          # L1 MCP server 통합 테스트
```
