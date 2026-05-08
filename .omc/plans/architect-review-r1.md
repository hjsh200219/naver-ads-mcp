# Architect Review — Round 1

## Executive Summary

Plan은 핵심 추론(Web 자동화 대신 API)에서 아키텍처적으로 건전하나 두 가지 중대한 결함이 있다: (1) **Day-0 보안 순서 결함** — 실제 자격증명이 보호되지 않은 `.env`에 존재하고 `.gitignore`도 git repo도 없는데 Plan은 이를 미래의 우려로 다룸 (즉시 비상 조치로 분리되어야 함); (2) **Option A에 대한 진짜 강력한 반론은 사용자 의도 불일치가 아니라 API 커버리지 범위** — Naver Search Ad API는 검색광고(SA)만 커버하지만, sister project 컨텍스트(HelloMax 6개 광고주)는 GFA·브랜드검색 등 다른 광고 상품도 운용함을 강하게 시사함. Plan은 어떤 광고 상품이 대상인지 묻지 않았다.

**Verdict: APPROVE_WITH_REVISIONS** — 7개 필수 수정 사항.

---

## 1. Steelman Antithesis (Option A에 대한 최강의 반론)

Plan이 제시한 "사용자가 ID/PW를 줬는데 API 키를 요구한다"는 반론은 약한 편이다. 진짜 강력한 반론은 **API 커버리지 범위의 근본적 한계**다.

네이버 Search Ad API (`api.searchad.naver.com`)는 **검색광고(SA)만** 커버한다. 그런데:

- Sister project `zebra-brothers-ax`는 HelloMax 6개 광고주의 **주간 성과 리포트 AI 분석** 시스템이다 (`/Users/hoshin/workspace/ProjectMarketing/zebra-brothers-ax/CLAUDE.md` 참조).
- HelloMax는 네이버 검색광고 대행사이지만, 실무에서 대행사 계정은 검색광고 외에도 **GFA(성과형 디스플레이 광고)**, **브랜드검색**, **파워컨텐츠**, **쇼핑검색** 등 복수 광고 상품을 운용하는 것이 일반적이다.
- `.env`의 계정은 검색광고 센터 마스터 계정일 가능성이 높으며, 이 계정이 관리하는 광고 인벤토리가 검색광고만인지 확인된 바 없다.

**즉, Option A(Search Ad API)를 권장하면서 이 API가 사용자의 실제 광고 인벤토리를 커버하는지 확인하지 않았다.** Plan의 Q1은 "작업 유형"(검증/조회/자동화)만 묻지, "어떤 광고 상품 데이터가 필요한가"(검색/디스플레이/브랜드)는 묻지 않는다. 만약 GFA 데이터가 필요하다면 Search Ad API로는 원천적으로 불가능하며, 이 경우 Option A 전체가 무효화된다. 이것은 Plan 섹션 6의 미결 질문 어디에도 없는 **누락된 핵심 질문**이다.

## 2. Tradeoff Tensions

**Tension 1: 보안 즉시성 vs 계획 순서성**

Plan 섹션 4는 `.gitignore`가 이미 존재한다고 가정하고 Pre-mortem 시나리오 1은 ".env가 .gitignore에 누락된 채 git add . 실행"을 미래 위험으로 다룬다. 그러나 **현재 실제 상태**: `.gitignore` 파일 자체가 존재하지 않고, git repo도 초기화되지 않았으며, `.env`에는 실제 네이버 계정 비밀번호가 평문으로 존재한다. 네이버 ID 하나가 메일·페이·카페·블로그를 모두 커버하므로, blast radius가 광고 계정에 한정되지 않는다.

구체적 결과: 누군가가 지금 `git init && git add .`를 실행하면 비밀번호가 git history에 영구 기록된다. Plan의 "구현 시작 후 .gitignore 생성" 순서로는 이 창을 닫을 수 없다.

**Tension 2: 단일 CUSTOMER_ID 가정 vs 다중 하위 계정 현실**

Plan 섹션 4는 `NAVER_ADS_CUSTOMER_ID` 하나를 가정한다. 그러나 네이버 광고 대행사 계정은 복수의 광고주를 하위 계정으로 관리하는 것이 일반적이다. HelloMax가 6개 광고주를 운용한다는 sister project 컨텍스트를 고려하면, 단일 CUSTOMER_ID로는 한 광고주 데이터만 접근 가능하고 나머지 5개는 별도 CUSTOMER_ID가 필요할 수 있다. 이 경우 config 구조와 CLI 인터페이스가 근본적으로 달라진다 (단일 값 → 맵/배열 + 선택 로직).

## 3. Principle Violations / Under-addressed Concerns

**P1 (자격증명 안전) — 순서 위반 (Critical)**

Plan이 `.gitignore`를 파일 구조에 포함시키고 Pre-mortem이 ".gitignore에 .env 포함을 첫 번째 작업으로 수행"이라 명시했지만, 이것이 **Step-0 (구현 전 즉시 실행)** 으로 분리되어 있지 않다. 현재 `.env`에 실제 자격증명이 이미 존재하는 상태에서 Plan은 "구현 스켈레톤" 안에 `.gitignore`를 넣어두었을 뿐, 독립적인 긴급 조치 항목으로 분리하지 않았다. 추가로 이 `.env` 내용이 이미 에이전트 대화 기록·셸 히스토리·다른 세션 transcript에 노출되었을 가능성에 대한 포렌식 검토 절차가 Plan에 없다.

**P3 (검증 가능성) — 테스트 벡터 부재**

Plan 확장 테스트에서 "네이버 공식 문서의 예시값과 대조하여 서명 정확성 검증"이라고 했으나, 네이버 Search Ad API 공개 문서는 **HMAC 테스트 벡터(known-answer test)를 제공하지 않는다**. 따라서 이 테스트 항목은 aspirational이다. Plan은 "fixture-capture 절차" (실제 API 호출 1회의 request/response를 기록하여 픽스처로 사용)를 명시해야 한다.

**P4 (그린필드 단순성) — 배포 타겟 미확정**

Plan의 D3과 Q3가 운영 환경을 미결로 남겨두면서, 동시에 섹션 4의 구현 스켈레톤이 CLI 구조(`src/cli.ts`)로 확정되어 있다. Vercel cold-start, GitHub Actions OIDC, 서버 데몬은 CLI 진입점과 근본적으로 다른 설계를 요구한다. "네 가지 모두 지원"은 P4(과설계 금지)에 위배된다. 하나를 primary로 확정하고, credential loader를 swap point로 설계해야 한다.

## 4. Architectural Concerns by Section (A-H)

**A. User intent mismatch risk** — Plan이 Q1-Q4로 사전 확인을 요구한 것은 올바르다. "API 키 발급 요구가 방어 가능한가?" 답: **방어 가능하다, 단 조건부로**. ToS 준수·HMAC 보안·봇 탐지 회피 근거는 타당하다. 다만 사용자(AE/광고 운영자) 대상의 API 키 발급 절차 가이드(스크린샷 포함)가 AC에 없다. 현재 AC-5는 개발자 대상 README 언급만 있다.

**B. Library/runtime choice** — TypeScript/Node 20+는 방어 가능. Sister project가 TS 스택이므로 일관성 있다. 단 sister project에 `package.json`이 아직 없고 docs만 있는 상태이므로 "일관성"은 약한 근거임을 인지해야 한다. TS 선택의 진짜 근거는 Vercel 배포 호환성과 팀 역량. 권장: TS 유지.

**C. HMAC signing surface** — Plan의 HMAC 설명이 부족. 다음을 명시해야 한다:

1. **Timestamp 단위**: epoch milliseconds. Plan은 "타임스탬프"라고만 표기.
2. **서명 페이로드 형식**: `{timestamp}.{method}.{URI}` (URI는 path만, query string 미포함).
3. **Clock skew tolerance**: ±5분 가량.
4. **헤더 이름 정확성**: `X-API-KEY`는 ACCESS_LICENSE 값. SECRET_KEY는 서명 생성 시에만 사용.
5. **재시도 의미론**: 401 → 새 timestamp 재서명 1회 시도, 5xx → exponential backoff, 429 → `Retry-After` 존중.

**D. Secrets handling depth** — 현재 수준은 **최소 요건도 충족하지 못한다** — `.gitignore`가 부재하기 때문. 추가 레이어 평가:

- Sealed object: 과도. `enumerable: false`로 충분.
- Buffer zeroing: Node GC 모델에서 실효성 낮음, 불필요.
- 1Password CLI: 그린필드 MVP에서는 P4 위반. 배포 타겟 확정 후 재검토.
- **즉시 조치**: `.env` 비밀번호의 transcript 노출 가능성 → 비밀번호 변경 권고를 Plan에 추가.

**E. Single-binary vs library shape** — Plan의 `src/naver-ads/` 구조는 이미 라이브러리 형태. 개선점: `package.json`의 `exports` 필드와 barrel export(`src/naver-ads/index.ts`)를 두면 sister project에서 import 가능. 향후 npm workspace 전환 여지 확보.

**F. Deployment target ambiguity** — 네 타겟을 동시에 미결로 두는 것이 문제. Vercel cold-start, GitHub Actions OIDC, 서버 데몬 graceful shutdown은 CLI 진입점과 다른 설계를 요구. **권장**: Local CLI를 primary로 확정, credential loader 추상화로 swap 가능하게 설계.

**G. Pre-mortem completeness** — 누락된 고영향 시나리오:

1. **Rate limit / 429 quota exhaustion**: 6개 광고주의 캠페인+키워드 조회 시 quota 초과 가능. 대응: throttling, `Retry-After` 존중, partial failure 처리.
2. **Multiple CUSTOMER_ID**: 단일 ID 구조의 깨짐. 대응: config 배열/맵 허용.
3. **Key rotation procedure**: 키 발급자 퇴사·유출 시 절차 부재. 대응: README에 키 회전 섹션 추가.
4. **Corporate proxy / egress policy**: HMAC 헤더 strip 시 인증 실패. 대응: verbose logging.
5. **이미 노출된 자격증명 창**: agent transcript·shell history 노출 가능성. 대응: 즉시 비밀번호 변경 권고.

**H. Test plan rigor**:

1. **HMAC 단위 테스트**: 공식 test vector 부재 → **fixture-capture 절차**로 전환.
2. **Integration test**: CI에서 자격증명 주입 어떻게? `credentials-required` 마커로 분리, CI skip, 로컬/staging 실행 전략 필요.
3. **보안 회귀 테스트**: `git ls-files`는 git repo 초기화 후에만 동작. Step-0에 `git init` 포함 필요.
4. **HMAC validator mock**: 네이버 서버 검증 로직 mock 불가능. 테스트 전략은 "서명 생성 결정론적 재현성 검증"이어야 함.

## 5. Synthesis (반론과의 화해 방안)

1. **Q5 추가** (섹션 6 미결 질문): "필요한 광고 데이터가 검색광고(SA)만인가, GFA/브랜드검색 등 다른 광고 상품도 포함하는가?" 이 질문 답에 따라:
   - SA만: Option A 확정, 현재 Plan 유지
   - SA + 다른 상품: Option A로 SA 데이터 우선 구현 + 다른 상품은 별도 API/Option B를 로드맵에 명시
   - 다른 상품만: Option A 재검토 필요

2. **Step-0 긴급 조치** 분리: `git init` → `.gitignore` 생성 → `.env` 보호 확인 → 비밀번호 변경 권고. P1 원칙의 순서적 충족.

3. **배포 타겟 확정**: Q3 기본값(로컬 CLI)을 명시적 primary로 채택, 다른 타겟은 "확장 가능성"으로만 언급.

4. **HMAC 스펙 보강**: timestamp ms·서명 페이로드 형식·clock skew·재시도 의미론 명시. 테스트 벡터는 fixture-capture로 전환.

## 6. Verdict

- [ ] APPROVE_AS_IS
- [x] APPROVE_WITH_REVISIONS
- [ ] REJECT_AND_RETHINK

### Required Revisions (필수 수정 사항)

1. **[Critical/Security] Step-0 즉시 조치 항목 분리** — 구현 스켈레톤 앞 독립 섹션으로 `git init` + `.gitignore` 생성 + 기존 `.env` 비밀번호 변경 권고 + 노출 포렌식 확인 절차 추가. blast radius가 광고 계정 너머 메일·페이·카페까지 미침을 Pre-mortem에 반영.

2. **[Critical/Scope] Q5 추가** — "필요한 광고 데이터의 광고 상품 유형은? (검색광고만 / GFA 포함 / 브랜드검색 포함)". Option A 적용 가능성을 검증하는 필수 질문.

3. **[High] HMAC 서명 스펙 보강** — `client.ts` 설명에 timestamp 단위(ms), 서명 페이로드 형식 `{ts}.{method}.{path}`, clock skew ±5분, 401/429/5xx 재시도 의미론 명시. 네이버 API 문서 URL 인용.

4. **[High] 테스트 벡터 전략 수정** — "공식 문서 예시값 대조" → "fixture-capture 절차"로 전환. CI용 `credentials-required` 테스트 마커 도입. `git ls-files` 테스트 전제조건(git repo) 명시.

5. **[Medium] 배포 타겟 단일 확정** — Q3 기본값(로컬 CLI)을 primary로 채택, 섹션 4 파일 구조가 해당 타겟에 최적화되었음을 명시. credential loader를 swap point로 설계.

6. **[Medium] 다중 CUSTOMER_ID 고려** — 대행사 계정 + 6개 광고주 컨텍스트에서 복수 하위 계정 가능성 언급. config 구조가 향후 배열/맵으로 확장 가능해야 함.

7. **[Low] Pre-mortem 보강** — Rate limit/429, key rotation 절차, proxy 환경 대응 시나리오 추가.

---

## References

- `/Users/hoshin/workspace/ProjectMarketing/naver-ads-mcp/.env` — 실제 자격증명 평문 저장 확인
- `/Users/hoshin/workspace/ProjectMarketing/naver-ads-mcp/` — `.gitignore` 부재, git repo 미초기화 확인
- `/Users/hoshin/workspace/ProjectMarketing/zebra-brothers-ax/CLAUDE.md` — HelloMax 6개 광고주 컨텍스트 (sister project)
- Plan 섹션 4 — 파일 구조 (`.gitignore` 존재 가정)
- Plan 섹션 6 — Q1-Q4 (광고 상품 유형 질문 누락)
- Plan Pre-mortem 시나리오 1 — 자격증명 유출 (미래형으로 기술)
- Plan 확장 테스트 — HMAC "공식 문서 예시값 대조" (실행 불가능)
