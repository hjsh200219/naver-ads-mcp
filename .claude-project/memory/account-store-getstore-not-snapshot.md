---
name: account-store-getstore-not-snapshot
description: 다중 광고주 컨텍스트에서 자격증명 조회는 getStore() 호출로 lazy resolve해야 함 — deps.accountStore 직접 캡처는 env-only mode + hot-reload 시 stale snapshot
type: project
created: 2026-05-21
---

# Account Store 접근 — getStore() 사용 필수

## 사실

`src/mcp/server.ts`는 `accountStore`를 두 가지 모드로 받을 수 있음:

1. **explicit injection**: `deps.accountStore` 직접 주입 (test/CLI 경로)
2. **env-only mode**: `deps.accountStore === undefined` → `getStore()`가 lazy로 `credentialLoader`로부터 single-account 스토어 빌드 (production stdio 경로)

`prepare_daily_dashboard` 초기 구현에서 `findAccountForClient`가 `deps.accountStore`를 직접 읽음:

```ts
const store = deps.accountStore;
if (!store) return undefined; // ❌ env-only mode에서 항상 undefined → 모든 client mapping이 "매핑 없음"으로 silent fallthrough
```

증상:

- live 테스트는 explicit injection으로 통과 (accountStore 직접 주입)
- production 배포는 env loader만 사용 → `findAccountForClient`가 항상 undefined 반환 → empty payload + warning, violations 탐지 불능
- 발견 어려움: warning 메시지가 "광고주-계정 매핑 없음 (customer_id 미설정)"으로 client-mappings.json 문제처럼 보임

## 수정 (d501a87)

```ts
const store = getStore(); // lazy resolver — env-only mode도 cover
const entry = store.list().find((a) => a.customerId === m.customer_id);
return entry?.name;
```

## **Why:** advisor pass에서 적발된 silent failure. 8주간 parseTsv corruption 버그와 같은 패턴 — 테스트 모드 한정 동작, production 침묵. 자격증명 캡처는 반드시 lazy resolver 호출로.

## **How to apply:** `src/mcp/server.ts` 내 `deps.accountStore` 직접 참조 코드를 새로 추가할 때는 반드시 `getStore()` 사용. `clientCache` Map도 동일 위험 — credential rotation 시 stale entry 가능 (현재 customerId 키로 캐시하므로 cred 동일성 가정). 추후 hot-reload 도입 시 cache invalidation 추가 필요.
