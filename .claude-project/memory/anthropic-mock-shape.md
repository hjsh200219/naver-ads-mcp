---
name: anthropic-mock-shape
description: IAnthropic.generate 모킹 시 반환 shape — {content: string(JSON), cache_hit: boolean}, content는 파싱된 객체가 아닌 JSON 문자열
type: reference
created: 2026-05-11
---

# IAnthropic mock signature

## Contract

`IAnthropic.generate(...)` 의 반환 타입:

```ts
{
  content: string; // JSON.stringify된 AiAnalysis 문자열 (파싱된 객체 아님)
  cache_hit: boolean; // prompt-cache hit 여부
}
```

## 흔한 실수

테스트 더블에서 다음처럼 작성하면 caller의 `JSON.parse(result.content)`가 실패한다:

```ts
// WRONG — AiAnalysis 객체를 그대로 넣음
generate: async () => ({ content: { summary: "...", ... }, cache_hit: false })

// CORRECT — stringify된 JSON 문자열
generate: async () => ({
  content: JSON.stringify({ summary: "...", /* ... */ }),
  cache_hit: false,
})
```

## 적용 위치

- `tests/**` 에서 `IAnthropic` 모킹 시
- E2E driver 셋업 시 (이전 세션에서 driver friction 원인이었음)
- 신규 AI-consuming tool 추가 시 reference로 사용

## 관련

- `src/anthropic/client.ts` — 실제 구현부
- `anthropic-client-lazy-factory.md` — DI lazy factory 패턴
- `anthropic-data-transmission-policy.md` — 데이터 전송 정책
