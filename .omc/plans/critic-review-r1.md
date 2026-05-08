# Critic Evaluation — Round 1

## Executive Summary

Plan의 핵심 아키텍처 결정(Web 자동화 대신 공식 API)은 건전하고, Architect의 7개 수정 항목은 정확하다. 그러나 Plan은 현재 디스크 상태(git repo 없음, .gitignore 없음, 실제 비밀번호 평문 노출)를 "미래 위험"으로 취급하는 순서 결함이 있고, Acceptance Criteria 다수가 현재 상태에서 검증 불가능하며, Architect가 덜 강조한 몇 가지 독립적 이슈가 있다. **ITERATE** — Architect 7개 + Critic 4개 = 11개 항목을 반영한 후 재심사.

## 1. Principle-Option Consistency

| 원칙 | Option A 일치 | 근거 |
|------|--------------|------|
| P1 자격증명 안전 | 일치 (단, 순서 결함) | HMAC으로 평문 회피. 현재 `.env` 노출 미해소 → P1 순서적 위반 |
| P2 합법성·ToS | 완전 일치 | 공식 API |
| P3 검증 가능성 | 부분 일치 | HMAC 테스트 벡터 부재·AC-3 검증 불가능 |
| **P4 그린필드 단순성** | **불일치 — 미고지 트레이드오프** | API 키 3종 발급이라는 blocking dependency 부과. ADR에 명시 누락 |
| P5 점진적 위험 | 완전 일치 | API 우선 순서 |

**결론**: Option A가 P4와 충돌하는 의도적 트레이드오프임을 ADR에 한 문장으로 명시 필요.

## 2. Fair Alternatives Check

- **Option C(OAuth)**: strawman 아님. 기술적으로 Naver OAuth 토큰으로 ads.naver.com 데이터 접근 불가 → 정당한 배제.
- **Option B(Web 자동화) 평가**: 공정. 단 "현재 .env ID/PW 그대로 사용 가능"의 사용자 가치를 충분히 인정하지 않았다 (Architect Steelman이 보완).
- **누락된 옵션**: Hybrid (SA는 API + GFA는 Web). Q5 답변에 따른 분기 경로를 Plan에 명시해야 함.

## 3. Risk Mitigation Clarity

### Plan 원본 3개

| 시나리오 | 구체성 | 실행 가능성 | 책임 주체 |
|---------|-------|------------|----------|
| 자격증명 유출 | 4개 조치 (구체적) | **순서 결함** — Step-0 미분리 | **미명시** |
| 봇 탐지 | 적절 | Option A 시 회피 | 미명시 |
| 목적 불일치 | Q1-Q4 | 실행 가능 | 미명시 |

### Architect 추가 5개

- Rate limit / 429: throttling 언급, 구체 수치 미명시
- Multi CUSTOMER_ID: 방향 제시만 (Medium 수용 가능)
- Key rotation: README 절차 (적절)
- Corporate proxy: verbose logging (Low 수용 가능)
- 노출 자격증명 창: "권고" — **불충분 (섹션 8 Finding 1)**

**공통 문제**: 모든 mitigation이 수동태. 책임 주체(사용자/구현자/검증자) 미구분.

## 4. Acceptance Criteria Testability

| AC | 검증 가능 여부 | 문제 |
|----|-------------|------|
| AC-1 | **현재 검증 불가** | git repo 부재 → `git ls-files` 동작 불가. Step-0의 `git init` 선행 필요 |
| AC-2 | 가능 | 구체 명령어 예시 부재 |
| AC-3 | **구조적 검증 불가** | 키 발급 후에만 검증 가능. 키 미발급 시 만족 경로 부재. 분리 필요 (3a/3b) |
| AC-4 | 가능 | 구체 정규식 부재 |
| AC-5 | 가능 | `grep -c 'searchad.naver.com' README.md` |
| AC-6 | 가능 | `tsc --noEmit` |
| AC-7 | 가능 | `npm test` |

**핵심 문제**: AC-1 (git repo 전제) + AC-3 (키 발급 전제) 모두 외부 의존성에 종속.

## 5. Verification Steps Concreteness

- 환경 셋업: `npm init`/`package.json` 초기 생성 절차 부재
- 의존성 설치: `npm install` 언급, 개별 패키지(dotenv·vitest·tsx·typescript) 명시 부족
- API 키 발급 절차: 요약 수준 (정확한 URL·메뉴 경로 필요)
- Step-0 긴급 조치: 미분리

**결론**: executor가 첫 줄부터 추측 없이 실행하기에는 환경 초기화 + Step-0 분리 부족.

## 6. Deliberate Mode Requirements

- **Pre-mortem 시나리오**: Plan 3 + Architect 5 = 8개 (요건 3개 초과, 충실)
- **Test plan 4계층**:
  - Unit: 적절 (HMAC fixture-capture로 전환 필요)
  - Integration: **불충분** — 실서버만 있고 mock 부재. credentials-required 마커 필수
  - E2E: 적절
  - Observability: 적절
- **보안 회귀 테스트 전제**: **미충족** — git repo 부재. Step-0의 `git init` 필요.

## 7. Architect 권고 7개 항목 검토

1. **Step-0 긴급조치 분리** [Critical] — 필수, **더 강화 필요**: "권고" → "필수 gate" 격상 (Finding 1)
2. **Q5 광고 상품 유형** [Critical] — 정확. Sister project context로 GFA 가능성 실재. 반영 필수
3. **HMAC 스펙 보강** [High] — 5개 항목 필수
4. **테스트 벡터 전략** [High] — fixture-capture + credentials-required 마커 필수
5. **배포 타겟 단일 확정** [Medium] — 로컬 CLI primary 채택, P4 부합
6. **다중 CUSTOMER_ID** [Medium] — config 확장 가능성으로 충분
7. **Pre-mortem 보강** [Low] — 적절

## 8. Critic 추가 발견 이슈

### Finding 1 [CRITICAL]: 비밀번호 노출은 "권고"가 아니라 이미 발생한 사고

- **Confidence**: HIGH
- **Evidence**: `.env`에 평문 비밀번호. 본 RALPLAN-DR 워크플로우의 최소 3개 에이전트 세션 transcript에 노출. 네이버 통합 계정 → blast radius (메일·페이·카페·블로그·클라우드).
- **Plan 처리**: Pre-mortem 시나리오 1이 미래형. Architect "변경 권고"로 격상.
- **Critic 판단**: "권고" 부족. **필수 사전조건 (gate)** 으로 격상:
  1. 네이버 계정 비밀번호 즉시 변경
  2. 2FA 활성화 확인
  3. `git init` + `.gitignore` 생성
  4. `.env`에서 ID/PW 행 제거 (Option A 확정 시)
  5. 미통과 시 구현 착수 불가

### Finding 2 [MAJOR]: AC-3의 구조적 검증 불가능성

- **Evidence**: AC-3 ("실서버 read 200")은 키 3종 발급 후만 검증 가능. Q2 미결 시 충족 경로 없음.
- **Fix**:
  - **AC-3a** (키 미발급): "HMAC 서명 함수가 고정 입력에 대해 결정론적 출력 생성" — fixture 테스트
  - **AC-3b** (키 발급 완료): "실 API read 1건 → HTTP 200" — `npm start`

### Finding 3 [MINOR]: `.env.example`의 deprecated 경로 잔존

- **Evidence**: `.env.example`에 `# NAVER_ADS_ID` / `# NAVER_ADS_PW` 주석 존재
- **Fix**: Option A 권장 시 deprecated 변수명 제거. "Option B는 별도 문서 참조" 링크만 남김.

### Finding 4 [MAJOR]: Mitigation 책임 주체 전면 부재

- **Evidence**: 모든 mitigation 수동태 ("수행", "포함", "추가")
- **Fix**: 3개 역할 구분
  - **사용자**: API 키 발급, 비밀번호 변경, 2FA 활성화
  - **구현자/executor**: `.gitignore` 생성, 코드 구현, 테스트 작성
  - **검증자/reviewer**: AC 검증, 보안 회귀 확인

## 9. Verdict

- [ ] APPROVE
- [x] **ITERATE** — Plan은 11개 수정 사항 반영 후 재심사
- [ ] REJECT

### Required Actions for next iteration

**Architect 7개 (전부 반영)**:
1. Step-0 분리 — 단, "권고" → **"필수 gate"** 로 격상 (Finding 1 반영)
2. Q5 광고 상품 유형 + 답변에 따른 분기 경로
3. HMAC 스펙 5개 항목
4. 테스트 벡터 → fixture-capture + credentials-required 마커
5. 배포 타겟 로컬 CLI 단일 확정
6. 다중 CUSTOMER_ID 확장 가능성
7. Pre-mortem 5개 시나리오 추가

**Critic 추가 4개**:
8. AC-3 → AC-3a (fixture) + AC-3b (실서버) 분리
9. `.env.example` deprecated 변수 주석 제거
10. 모든 mitigation에 책임 주체 (사용자/구현자/검증자) 명시
11. ADR에 P4 트레이드오프 한 문장 명시

### Decisive criteria for moving to APPROVE on next round

- Step-0이 독립 섹션으로 분리되고 비밀번호 변경이 gate로 기재됨
- AC-1의 git repo 전제, AC-3의 키 발급 전제가 명시되고 분리됨
- Q5가 미결 질문에 추가되고 분기 경로 명시됨
- HMAC 스펙 5개 항목이 client.ts 설명에 반영됨
- Mitigation에 최소 사용자/구현자/검증자 구분 존재
- ADR에 P4 트레이드오프 명시
- Critical 2 + Major 2 = 4개 finding이 모두 해소됨

---

**Ralplan Summary Row**:
- **Principle/Option Consistency**: Fail — ADR P4 트레이드오프 미고지
- **Alternatives Depth**: Pass (조건부) — Q5 분기 명시 필요
- **Risk/Verification Rigor**: Fail — AC-1/AC-3 검증 불가, 책임 주체 부재, 비밀번호 노출 처리 미흡
- **Deliberate Additions**: Pass (조건부) — Integration CI 전략 부재, Architect 수정 반영 시 충족

핵심 아키텍처는 건전. 11개 수정 반영 시 APPROVE 가능 수준.
