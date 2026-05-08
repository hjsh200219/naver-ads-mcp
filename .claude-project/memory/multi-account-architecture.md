---
name: multi-account-architecture
description: 다중 광고주 자격증명 관리 아키텍처 (accounts.json + L4 store + L1 bootstrap)
type: project
created: 2026-05-08
---

`accounts.json` 기반 다중 광고주 자격증명 레지스트리. MCP 도구는 `account?: string` 인자로 어느 광고주 자격증명을 쓸지 선택.

**Why:** 단일 MCP 서버 인스턴스에서 여러 광고주 데이터를 fetch해야 하는 마케팅 대행사 시나리오. `.env` 단일 계정 또는 N개 MCP 서버 등록 방식은 UX/운영 부담이 큼. ralplan consensus iteration v2.1로 Architect+Critic 합의.

**How to apply:**

레이어 구조 (절대 변경 금지):

- L4 `src/config/account-store.ts` — `IAccountStore` + `MapAccountStore`. **`node:fs` 0 imports** (테스트 `tests/layer-rules.test.ts`가 grep으로 검증).
- L4 `src/config/credentials.ts` — `freezeCredential(customerId, accessLicense, secretKey)` 헬퍼. `enumerable:false` invariant 유지.
- L1 `src/runtime/account-bootstrap.ts` — JSON 파일 read + env fallback → MapAccountStore.
- `src/mcp/server.ts` — `accountStore` 주입, `account` 인자 라우팅, `customerId` 기반 client cache (default와 명시 호출이 동일 클라이언트 재사용).

보안 invariant:

- account 식별자 정규식 `^[a-zA-Z0-9_-]{1,64}$` Zod에서 검증. 위반 시 `"Invalid account identifier"` 고정 응답 (입력 미반사).
- `list_accounts` 응답은 `[{name, customerId}]`만. license/secret 절대 미반환 (`tests/account-store.test.ts:list()` 검증).
- 파일 mode `(mode & 0o077) !== 0` POSIX stderr 경고.

핫리로드 없음 — 자격증명 변경 시 MCP 서버 재시작 필수. `cli.ts`가 startup 시점에 `loadAccountStore()`를 eager call하므로 설정 오류 fail-fast.
