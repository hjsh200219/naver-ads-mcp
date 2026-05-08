# Architecture — Naver Ads MCP

## Overview

TypeScript MCP server. CLI binary가 `StdioServerTransport`로 연결되어 Claude Code 같은 MCP 클라이언트와 통신. Naver Search Ad API에 HMAC-SHA256으로 서명된 요청 + 비동기 StatReport 다운로드 + ExcelJS로 10시트 보고서 생성.

## Layer Structure (5 layers)

```
L1 Runtime  ─┐  src/cli.ts, src/mcp/server.ts, src/index.ts
             │  진입점. dotenv 로드, MCP 서버 wiring, tool 등록
             ↓
L2 Service  ─┐  src/raw/, src/pivot/, src/excel/, src/util/
             │  순수 함수 데이터 변환. RAW 빌더 / Pivot 집계 / Excel 작성 / 날짜 유틸
             ↓
L3 API      ─┐  src/api/{client,signer,stat-reports,metadata}.ts
             │  HMAC-SHA256 서명, NaverAdsClient (401/5xx/429 retry),
             │  StatReport 비동기 flow (POST→poll→GZ→TSV), 메타 API 헬퍼
             ↓
L4 Config   ─┐  src/config/credentials.ts
             │  EnvCredentialLoader (enumerable=false로 secret 비누출)
             ↓
L5 Types    ─┐  src/api/types.ts, src/pivot/types.ts, src/raw/builder.ts (interfaces)
             │  공유 인터페이스. INaverAdsClient, NaverCampaign, RawRowBase 등
             └─
```

**의존성 방향**: 위→아래만 허용. L5는 어디서든 import 가능 (타입). L1은 모든 하위 layer 사용. 동일 layer 내 import 가능. 역방향(L5→L4 등) 금지.

## Domain Boundaries

### API 도메인 (L3)

- `signer.ts` — 단일 책임: HMAC-SHA256 서명 생성. 입출력 순수 함수.
- `client.ts` — HTTP 추상화 + retry 정책. signer 주입 가능 (테스트용).
- `stat-reports.ts` — Naver의 비동기 보고서 flow. POST → poll → fetch GZ → parse TSV.
- `metadata.ts` — `/ncc/*` 헬퍼. 캠페인/광고그룹/키워드/상품 메타데이터.

### 데이터 도메인 (L2)

- `raw/` — Naver API 응답을 helloMAX 17-20 컬럼 한글 RAW row로 변환
- `pivot/` — RAW를 5개 표시용 시트로 집계 (SUMMARY, 매체별, 키워드, 상품, 검색어)
- `excel/` — 10시트 xlsx 생성 (브랜드검색 hidden placeholder 포함)
- `util/` — 날짜 정규화 (월별/주차 파생)

### Runtime 도메인 (L1)

- `mcp/server.ts` — `createServer({deps?})` 팩토리. 4 tools 등록 + Zod 검증
- `cli.ts` — stdio 진입점 (16줄)
- `index.ts` — 라이브러리 export (다른 프로젝트가 import 가능)

## Cross-Cutting Concerns

| 관심사              | 위치                                     | 정책                                                         |
| ------------------- | ---------------------------------------- | ------------------------------------------------------------ |
| 자격증명 보안       | `src/config/credentials.ts`              | `enumerable: false` on accessLicense/secretKey               |
| HMAC 서명           | `src/api/signer.ts`                      | payload = `{ts}.{METHOD}.{path-no-query}`. SECRET_KEY 비전송 |
| 에러 분류           | `src/api/client.ts` (`NaverAdsApiError`) | status 보존. 401/403/5xx 분류는 호출자에서                   |
| 재시도 정책         | `src/api/client.ts`                      | 401: 1회 재서명. 5xx: exp backoff 3회. 429: Retry-After 존중 |
| Polling             | `src/api/stat-reports.ts`                | initial 1s, max 30s, total 10min                             |
| Korean column names | `src/excel/headers.ts`                   | SSOT — 4 RAW 시트 헤더 한글                                  |

## Allowed Edges (Lint-Enforceable)

```
src/api/* ─ never imports → src/raw/, src/pivot/, src/excel/, src/mcp/, src/util/
src/raw/* ─ may import → src/api/types, src/util/
src/pivot/* ─ may import → src/raw/builder (types only)
src/excel/* ─ may import → src/raw/builder (types), src/pivot/types
src/mcp/* ─ may import → all of the above
src/cli.ts ─ may import → src/mcp/server only
src/config/* ─ never imports → src/api/, src/raw/, src/pivot/, src/excel/, src/mcp/
src/util/* ─ never imports → src/api/, src/raw/, src/pivot/, src/excel/, src/mcp/, src/config/
src/api/types.ts ─ never imports anything from src/
```

## Forbidden Patterns

- `src/raw/` 또는 `src/pivot/`에서 `src/api/client` 직접 import (INaverAdsClient 인터페이스만 사용)
- `src/api/`에서 `console.log(credentials)` 또는 자격증명을 에러 메시지에 포함
- 새 라이브러리 추가 (`fetch`/`crypto`는 native, 추가 의존성 도입은 PR로)
