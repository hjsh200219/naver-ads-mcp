---
name: naver-api-quirks
description: Naver Search Ad API 비공식 동작·한계 — 공식 문서에 명시 안 된 것 포함
type: reference
created: 2026-05-08
---

# 다차원 보고서

ads.naver.com UI의 "다차원 보고서"는 API로 제공 **안 됨**. 공식 답변 (Issue #1034):

> "다차원 보고서는 API로 제공하고 있지 않습니다. StatReport / Stat API를 활용해서 비슷한 데이터를 전달 받을 수 있습니다."

근사 재현:

- 키워드 운영성과 → `AD_DETAIL` reportTp
- 키워드 전환성과 → `AD_CONVERSION_DETAIL` reportTp

# 보관 기간 (공식 FAQ 기준)

| reportTp                          | 일수      |
| --------------------------------- | --------- |
| AD                                | 365       |
| AD_DETAIL                         | 180       |
| AD_CONVERSION                     | 365       |
| **AD_CONVERSION_DETAIL**          | **45** ⚠️ |
| EXPKEYWORD                        | 365       |
| SHOPPINGKEYWORD_DETAIL            | 180       |
| SHOPPINGKEYWORD_CONVERSION_DETAIL | 45        |
| SHOPPINGBRANDPRODUCT              | 365       |
| SHOPPINGBRANDPRODUCT_CONVERSION   | 365       |
| BRND_CONTRACT                     | 120       |

⚠️ 키워드 단위 전환을 365일치 보관하려면 매일 누적 수집 필수.

# 브랜드검색 영역별 성과 (홈링크/메인이미지/섬네일.1~9 등)

API 미제공. 공식 답변 (Issue #1072):

> "해당 지표는 소재관리화면에서만 제공되며 별도 리포트로 제공되지 않습니다."

UI 보관: 일자별 30일, 시간대별 7일. 자동화하려면 Playwright 외에 방법 없음 (ToS 회색지대 + 봇 탐지 위험).

# 비검색광고 상품

- 파워링크: `AD`, `AD_DETAIL`, `EXPKEYWORD`
- 쇼핑검색: `SHOPPINGKEYWORD_DETAIL`, `SHOPPINGKEYWORD_CONVERSION_DETAIL`, `SHOPPINGBRANDPRODUCT`
- 브랜드검색: `BRND_CONTRACT` (영역 분리 없음)
- **GFA(성과형디스플레이광고): 본 API 미지원**. 별도 GFA API 필요.

# HMAC 서명 (공식 문서가 모호한 부분)

- payload: `{ts_ms}.{METHOD}.{path}` — query string은 stripped
- timestamp: epoch milliseconds (string OK)
- 헤더: `X-Timestamp`, `X-API-KEY`(=ACCESS_LICENSE), `X-Customer`(=CUSTOMER_ID), `X-Signature`(base64)
- SECRET_KEY는 헤더에 안 들어감 (오직 서명 생성에만 사용)
- Clock skew 허용: 약 ±5분

# 재시도 정책

- 401: 새 timestamp로 재서명 1회. 그 후 401이면 throw
- 5xx: exponential backoff 3회
- 429: `Retry-After` 헤더 존중 (skipNextDelay flag로 double-wait 방지)

# /stat-reports = statDt 단일 일자 전용 (날짜 범위 미지원)

POST body = `{reportTp, statDt}` 단일 날짜만. startDate/endDate 범위 미지원. weekly 14일치 = 14 job × reportTp 수 = job 수 곱산. **job 수 축소 불가 → latency 개선은 병렬화가 유일 경로** (cap pool, [[concurrency-util-apply-scope]]). 관련 latency 실측: [[stat-report-latency-profile]], poll 동작: [[stat-report-poll-behavior]].

# 미래 statDt = 400 Bad Request (commit ab5b3ae)

`/stat-reports` POST에 `statDt > today` 보내면 **HTTP 400** 즉시 반환. `prepare_weekly_payload` live path가 ISO week `[Mon, Sun]` 7일치 fetch하면 진행 중인 주에서 5/22~5/24 등 미래 일자 포함 → 전체 fail.

대응 (src/mcp/server.ts `fetchByDay`, `fetchOne`):

- `statDt > toYmdCompact(new Date())` 인 일자는 호출 자체 skip (continue)
- 추가로 `NaverAdsApiError 4xx`도 `StatReportFailedError`와 동일 취급 (per-day skip). 5xx만 throw 전파
- 효과: live API path는 "현재 시점까지의 partial 데이터"로 graceful degrade

**Why:** Desktop에서 `prepare_weekly_payload({client, week:"2026-W21"})` 호출 시 "Client error (400)" 전체 fail. 미래 일자 + 4xx 거부 두 케이스가 합쳐진 결과.

**How to apply:** 새 live API path 추가 시 동일 두 가드 필수. 단일 일자 4xx로 전체 집계가 실패하면 사용자 디버깅 매우 어려움.

**Why:** 공식 문서가 부족하거나 GitHub Issues에서만 확인 가능한 사실. 새 reportTp 추가나 데이터 수집 cron 설계 시 반드시 참조.

**How to apply:** 새 보고서 추가 시 (1) reportTp 보관일 확인 → 45일 미만이면 누적 저장 설계 (2) 영역별 분리 데이터 요구 시 API 미지원임을 사전 고지 (3) HMAC 디버깅 시 payload 형식 정확히 매치.
