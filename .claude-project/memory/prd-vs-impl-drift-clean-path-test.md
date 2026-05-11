---
name: prd-vs-impl-drift-clean-path-test
description: PRD가 "X당 1건"을 명시하면 clean-path 카운트도 회귀 테스트로 단언해야 한다 (breach-path만 검증하면 drift 발생)
type: feedback
created: 2026-05-11
---

# PRD vs Impl drift — clean-path test gap

## 증상

`prepare_daily_dashboard`는 PRD US-020 AC에서 "광고주당 1건의 history entry를 기록한다"고 명시했으나, 구현부에 `if (violations.length > 0)` 가드가 있어 clean 광고주(위반 0건)는 `history.appendHistory`가 호출되지 않았다.

기존 테스트는 위반 발생 시 status/breach만 단언했고, "clean 광고주도 1건 기록된다"는 카운트 단언이 없어 PRD-구현 drift를 잡지 못했다.

## 원인

- 테스트가 happy-path 카운트를 빠뜨림 (breach-path side effect만 검증).
- "noise 줄이자"는 구현 직관이 PRD의 "audit trail 유지" 의도와 충돌했고, 테스트가 가드레일 역할을 못 함.

## 교훈

PRD/AC가 "per X writes one entry / always logs / one per call" 같은 카디널리티 명시를 하면:

1. clean-path 케이스 (위반·에러·예외 없음) 에서도 호출 횟수·기록 개수를 명시적으로 단언하는 회귀 테스트를 작성.
2. `expect(spy).toHaveBeenCalledTimes(N)` 형태로 카운트 자체를 단언 (status만 보면 누락 탐지 불가).
3. 구현 단계에서 "noise 줄이려고 skip" 직관이 들면 PRD AC를 다시 읽고 의도 확인.

## 적용

`tests/mcp/daily-history.test.ts` 등 N-per-client 시멘틱이 있는 모든 history/log writer 스펙에 clean-path count assertion 추가.
