---
name: anthropic-client-lazy-factory
description: cli.ts는 AnthropicClient를 즉시 생성하지 않고 anthropicFactory(`() => new AnthropicClient()`)로 createServer에 주입한다. ANTHROPIC_API_KEY 없는 사용자도 기존 5개 툴은 사용 가능하게 하기 위한 설계.
type: project
created: 2026-05-11
---

`src/cli.ts`가 `createServer({ anthropic: new AnthropicClient() })`로 즉시 인스턴스화하면, ANTHROPIC_API_KEY가 없는 환경에서는 부팅 자체가 `MissingAnthropicKeyError`로 실패한다. 그러면 weekly report 기능을 안 쓰는 사용자(validate_credentials / fetch_raw_data / generate_report만 사용)가 기존 워크플로우를 못 쓰게 된다.

해결책: `anthropicFactory: () => new AnthropicClient()` lazy 패턴.

```ts
// cli.ts
const anthropicFactory = () => new AnthropicClient();
const { server } = createServer({ accountStore, anthropicFactory });
```

```ts
// mcp/server.ts tool_prepare_weekly_dashboard
let anthropic = deps.anthropic;
if (anthropic === undefined && deps.anthropicFactory) {
  anthropic = deps.anthropicFactory();
}
if (anthropic === undefined) throw new Error("…requires ANTHROPIC_API_KEY…");
```

**Why:**

- 서버는 ANTHROPIC_API_KEY 없이도 boot 가능
- `prepare_weekly_dashboard` 첫 호출 시점에 키 부재가 loud failure로 표면화 (silent degrade 아님)
- 테스트는 여전히 `deps.anthropic`에 mock 주입 가능 — 우선순위가 명시적 anthropic > factory

**How to apply:**

- 새 외부 API 의존을 추가할 때 같은 패턴 검토. 부팅 차단이 합리적이지 않은 의존(특정 툴에서만 쓰이는 SDK)은 factory로.
- 테스트에서 `anthropic` 직접 주입 vs `anthropicFactory()` 호출 카운트로 lazy 확인 가능 (`tests/prepare-weekly-dashboard.test.ts` "anthropicFactory path: lazy construction at first tool use").
- `AnthropicClient` 생성자에서 `EnvAnthropicCredentialLoader().load()`가 throw하므로 factory 자체는 안전 — 실제 호출 시에만 키 확인.
