---
name: hallucination-guard-date-context-filter
description: ai-comment의 hallucination guard는 review_text의 숫자를 추출할 때 (월|일|주차|주|년|시|분) lookahead로 날짜 컨텍스트 숫자를 제외해야 한다. 안 그러면 "4월 4주차"의 "4"가 fabricated metric로 잘못 분류됨.
type: project
created: 2026-05-11
---

`src/analyzer/ai-comment.ts`의 `extractNumbers()`는 review_text에서 metric 인용 숫자를 뽑아낸다. 그런 다음 payload의 모든 숫자 집합과 비교해 ≥ 95% coverage인지 확인하고, 미달이면 confidence를 -0.3 한다.

**Why:**
초기 구현은 모든 `\d+`를 추출했다. 그러면 "4월 4주차 광고비 457,614원"에서 `4, 4, 457614`가 뽑힌다. payload는 보통 `[112415, 699, 457614, 55, 2362980, 516]` 같은 metric 값들이라 4가 없다. 결과적으로 정상적인 한국어 날짜 표현이 hallucination penalty를 trigger했다. AI plan v2.0의 "review_text는 광고주 전달용으로 인사말 포함"이라는 요구와 충돌.

해결책: 숫자 뒤에 한국어 시간 단위(`월/일/주차/주/년/시/분`)가 오면 metric claim이 아닌 calendar context로 간주하고 추출 대상에서 제외.

```ts
const DATE_UNIT_REGEX = /^(월|일|주차|주|년|시|분)/;
for (const match of text.matchAll(NUM_REGEX)) {
  const idx = match.index ?? 0;
  const after = text.slice(idx + match[0].length);
  if (DATE_UNIT_REGEX.test(after)) continue;
  // ...
}
```

**How to apply:**

- review_text에서 false-positive penalty가 발생하면 먼저 extractNumbers를 의심.
- 새 컨텍스트 단위(예: "분기", "반기")가 추가되면 DATE_UNIT_REGEX 확장.
- payload의 숫자 매칭 tolerance는 ±0.5 (`33.4` ≈ `33.397...` 같은 반올림 흡수). hallucinationCoverage()의 tolerance 상수 참조.
- 테스트: `tests/ai-comment.test.ts`의 "preserves confidence at or above 0.95 hallucination coverage" + "penalizes confidence by 0.3 when review_text has fabricated numbers".
