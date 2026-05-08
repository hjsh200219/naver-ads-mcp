# Architect Review — Round 2

## Executive Summary

Revised plan은 Round-1에서 요구한 7개 Architect 수정 사항과 Critic의 4개 추가 발견을 모두 충실히 반영했다. Step-0 Gate가 독립 섹션으로 분리되어 구현 차단이 명확하고, Q5 광고 상품 유형 분기 경로가 단순 질문 추가에 그치지 않고 3-way 라우팅으로 구체화되었으며, HMAC 스펙은 요구한 5개 항목을 초과하여 6개 항목을 표로 제시했다. 새로 도입된 구조(ICredentialLoader, fixture-capture, Record<string, Credentials> expansion path)가 기존 P4 원칙과 미세한 긴장을 만들지만, 이는 plan 문서 수준에서 수용 가능한 범위이며 architectural defect에 해당하지 않는다.

**Verdict: APPROVE_AS_IS**

---

## 1. Verification of Round-1 Required Revisions

| Tag | Action | Round-2 적용 상태 | 평가 |
|-----|--------|------------------|------|
| **[R-1]** | Step-0 Gate 분리 + 비밀번호 변경 격상 | **Applied** | 섹션 4 (line 215-251)가 섹션 5 앞 독립 top-level로 분리. "이 섹션의 모든 항목 완료 전 섹션 5 착수 불가" 명시. 4-1(비밀번호 변경 [사용자]) / 4-2(Git 보호 [구현자]) / 4-3(.env 정리 [구현자]) / 4-4(Gate 통과 확인 [검증자]) 4단계 체크리스트. Blast radius(메일·페이·카페·블로그·클라우드) 명시. "권고" → "필수" 격상 완료. |
| **[R-2]** | Q5 + 분기 경로 | **Applied** | Q5 line 378 추가. 섹션 3 line 196-202에 3-way 분기 테이블 (SA만 / SA+다른 상품 / 다른 상품만). Option Hybrid가 섹션 2 line 84-91에 독립 옵션으로 추가. D3가 line 52에서 "광고 상품 유형"으로 교체. 단순 질문 추가에 그치지 않고 라우팅 경로 + 구현 범위까지 명시. |
| **[R-3]** | HMAC 5개 항목 | **Applied (초과 달성)** | line 305-314에 6개 항목 표: timestamp ms, 페이로드 형식 + 예시, 알고리즘(HMAC-SHA256 Base64), clock skew ±5분, 헤더 매핑 4종 + SECRET_KEY 비전송, 재시도 의미론(401/5xx/429 구분). 네이버 API 문서 URL 인용. |
| **[R-4]** | fixture-capture + credentials-required | **Applied** | line 337-343에 5단계 절차(API 호출 → 기록 → 저장 → 검증 → SECRET 미포함 확인). credentials-required 마커가 line 169-170(Integration/E2E), line 177(CI vitest describe.skipIf 패턴)에 적용. git ls-files 테스트의 git repo 전제가 line 174 명시. |
| **[R-5]** | 로컬 CLI primary + credential loader | **Applied** | line 263 "로컬 CLI (primary)" + 다른 타겟은 "확장 가능성"으로만 언급. line 298 ICredentialLoader 인터페이스 + EnvCredentialLoader 구현체 + swap 가능 확장 포인트(Vercel/GitHub Actions/1Password) 명시. |
| **[R-6]** | 다중 CUSTOMER_ID | **Applied** | line 299 "Record<string, Credentials> 맵 확장 가능. MVP는 단일 값 + 확장 path 주석". Pre-mortem 시나리오 6 line 137-143에 mitigation + 책임 주체. ADR Follow-ups line 391에 "다중 CUSTOMER_ID 필요 시 config 확장" 포함. |
| **[R-7]** | Pre-mortem 5개 추가 | **Applied** | 기존 3 + 추가 5 = 8개 시나리오 (line 94-159). 추가분: (1) 노출 자격증명 창, (5) Rate limit/429, (6) Multi CUSTOMER_ID, (7) Key rotation, (8) Corporate proxy. 모든 mitigation에 [사용자]/[구현자]/[검증자] 태그. |

**Critic 추가 4개 항목:**

| Tag | Action | 상태 |
|-----|--------|------|
| [R-8] | AC-3 → AC-3a/AC-3b 분리 | **Applied** (line 361-362). AC-3a: fixture 결정론적 검증. AC-3b: 실서버 HTTP 200 (credentials-required). AC-1에 git repo 전제(line 359). |
| [R-9] | .env.example 정리 | **Applied** (line 325-335). API 키 3종 + "Web 자동화는 별도 문서" 1줄. |
| [R-10] | mitigation 책임 주체 | **Applied** — 15회 이상 [사용자]/[구현자]/[검증자] 태그 사용 (Pre-mortem 전 시나리오, Step-0 각 항목, fixture-capture 주의사항). |
| [R-11] | ADR P4 트레이드오프 | **Applied** (line 390). "Option A는 P4를 의식적으로 양보 — API 키 3종 발급 blocking dependency. P2·P5 가치가 P4 양보를 정당화 (~5분 1회성)." |

---

## 2. New Concerns (Round-2 Specific)

**Architectural defect: 없음.**

Round 2에서 도입된 새 구조(Step-0 Gate, ICredentialLoader, fixture-capture, Record<string, Credentials>, Hybrid Option) 모두 기존 Plan 구조와 일관성 유지. P4 추가 위반 점검:
- ICredentialLoader/EnvCredentialLoader: plan 문서에서 이름·역할만 정의 + "현재는 EnvCredentialLoader만 제공" 명시. 실제 코드가 아닌 설계 의도 수준 → MVP 과구현 위험 없음.
- Record<string, Credentials> expansion path: "MVP에서는 단일 값 + 확장 path 주석만 남긴다"라고 scope 제한 (line 299). 주석 1개가 P4 위반 아님.
- fixture-capture: 실 API 호출 1회의 자연스러운 부산물. 추가 인프라 불필요.

**Suggestion (비차단)**: ADR Consequences (line 390)에 ICredentialLoader 추상화·Record 맵 placeholder도 P4 미세 양보 항목으로 1줄 추가하면 문서 완결성 ↑. 그러나 architectural defect 아니라 문서 보완 사항.

---

## 3. Updated Steelman Antithesis

Round-1 최강 반론(Q5 미질문)은 **해소**됨.

**Round-2 최강 반론**: Plan은 보안 posture는 올바르나, executor 독립 실행 범위가 사실상 zero. 구현 시작 전 사용자 측 blocking dependency 5개:
1. 네이버 비밀번호 변경 (Step-0 4-1)
2. 2FA 활성화 확인 (Step-0 4-1)
3. API 키 3종 발급
4. Q1-Q5 해소
5. .env에 API 키 입력

Q5 답변이 "다른 상품만"이면 Plan 전면 재설계 가능성 존재 (line 202). Plan critical path가 전부 사용자 측에 있어 응답 지연 시 구현 무기한 대기.

**그러나 이것은 결함이 아니라 자격증명/보안 작업의 본질적 특성**. 사용자 행동 없이 자격증명 시스템 안전 구축 불가. Plan이 이 posture를 line 413에 적절히 소통.

---

## 4. New Tradeoff Tensions

**Tension (Round 2 specific)**:

P1(자격증명 안전) gating 강화가 P4(그린필드 단순성)·실행 속도와 긴장 심화. Round 1은 .gitignore만 만들면 구현 가능했으나, Round 2는 비밀번호 변경 + 2FA + API 키 발급 + Q5 해소 모두 선행 필요. 이는 올바른 보안 posture이며 Plan이 ADR(line 390)에서 P4 양보를 명시 인정 → conscious tradeoff.

P3(검증 가능성) 강화(fixture-capture·credentials-required·AC-3a/3b)도 path-to-first-execution을 연장하나, AC-3a가 키 미발급 상태에서도 검증 가능하도록 설계(line 361)되어 P3·P4 긴장 적절히 관리.

---

## 5. Principle Violations Status

| 원칙 | Round-1 상태 | Round-2 상태 |
|------|-------------|-------------|
| **P1 자격증명 안전** | 순서 위반 (Critical) | **해소** — Step-0 Gate 분리, 비밀번호 변경 필수 gate, blast radius 명시 |
| **P2 합법성/ToS** | 완전 부합 | 완전 부합 (변동 없음) |
| **P3 검증 가능성** | 테스트 벡터 부재 (High) | **해소** — fixture-capture 5단계, AC-3a/3b 분리, credentials-required, CI skip |
| **P4 그린필드 단순성** | 배포 타겟 미확정 (Medium) | **적절히 관리됨** — 로컬 CLI primary 확정, ADR P4 양보 명시. ICredentialLoader는 plan 수준 설계 의도로 과구현 아님 |
| **P5 점진적 위험** | 완전 부합 | 완전 부합 (Q5 분기 경로가 Hybrid escalation 단계화) |

---

## 6. Verdict

- [x] **APPROVE_AS_IS** — Round-1의 7개 + Critic 4개 = 11개 항목 모두 충실 반영. 새로운 architectural defect 없음.
- [ ] APPROVE_WITH_REVISIONS
- [ ] REJECT_AND_RETHINK

**Optional Suggestions (비차단)**:
1. ADR Consequences에 ICredentialLoader/Record 맵 placeholder도 P4 미세 양보 1줄 추가 → 문서 완결성 ↑
2. Plan 마지막 줄(line 413)을 사용자 blocking dependency 5개의 numbered list로 정리 → 사용자 행동 유도 효과 ↑

---

## Consensus Addendum (RALPLAN-DR Deliberate Mode)

- **Antithesis (steelman)**: critical path가 전부 사용자 측 blocking dependency. Q5 답변이 "다른 상품만"이면 Plan 재설계 가능. 그러나 자격증명/보안 작업의 본질적 특성이며 Plan이 line 413에서 적절 소통.
- **Tradeoff tension**: P1 보안 gating 강화 vs P4 실행 속도. ADR에서 P4 양보를 conscious tradeoff로 명시 인정.
- **Synthesis**: AC-3a + fixture-capture 분리로 사용자 blocking 해소 전에도 HMAC 단위 테스트 작성 가능 (부분 완화).
- **Principle violations (deliberate mode)**: 없음. R1의 Critical(P1)·High(P3)·Medium(P4) 모두 해소.

---

## References

- naver-ads-access-plan.md:215-251 — Step-0 Gate 독립 섹션
- naver-ads-access-plan.md:196-202 — Q5 3-way 분기 경로
- naver-ads-access-plan.md:305-314 — HMAC 6개 항목 표
- naver-ads-access-plan.md:337-343 — Fixture-capture 5단계
- naver-ads-access-plan.md:298 — ICredentialLoader + EnvCredentialLoader
- naver-ads-access-plan.md:299 — Record<string, Credentials> expansion
- naver-ads-access-plan.md:94-159 — Pre-mortem 8 시나리오
- naver-ads-access-plan.md:361-362 — AC-3a/AC-3b 분리
- naver-ads-access-plan.md:390 — ADR P4 트레이드오프
- naver-ads-access-plan.md:378 — Q5 미결 질문
- open-questions.md:8 — Q5 동기화 확인
