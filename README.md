# 네이버 검색광고 MCP 서버 (helloMAX 보고서 자동화)

## 무엇을 하는가

네이버 검색광고 API를 통해 광고주의 운영·전환 데이터를 자동 수집하고 두 흐름의 산출물을 만드는 MCP 서버.

1. **Raw 분석 엑셀** (`generate_report`) — `(FORM) helloMAX Report.xlsx`와 동일한 10시트 xlsx (브랜드검색 성과는 hidden placeholder, AE 수기)
2. **주간 대시보드** (2-tool 파이프라인) — KPI 집계 → 호스트 LLM 분석 → 광고주 발송용 html/xlsx + AE preview artifact

helloMAX form xlsx **없이** 호출 가능 (live API 자동 fetch). xlsx 수동 입력 path도 fallback으로 유지.

| 구분                     | 시트                                                      | 자동화 방식                                      |
| ------------------------ | --------------------------------------------------------- | ------------------------------------------------ |
| 표시(Pivot)              | SUMMARY, 매체별 성과, 키워드 성과, 상품 성과, 검색어 성과 | 클라이언트 측 집계                               |
| 표시(템플릿 placeholder) | **브랜드검색 성과**                                       | ⚠️ **API 미지원** — placeholder 시트 (수기 입력) |
| 원천(RAW)                | 일별RAW, 키워드RAW, 검색어RAW, 소재RAW                    | `/stat-reports` API                              |

## 브랜드검색 성과 시트는 왜 자동화되지 않는가

네이버 검색광고 공식 답변 (GitHub Issue [#1072](https://github.com/naver/searchad-apidoc/issues/1072)):

> "해당 지표는 소재관리화면에서만 제공되며 별도 리포트로 제공되지 않습니다."

브랜드검색 광고의 영역별 성과(홈링크/메인이미지/타이틀/섬네일.1~9 등)는 `ads.naver.com`의 소재관리 화면에서만 확인 가능하며, API로는 제공되지 않습니다. 따라서 본 MCP는 브랜드검색 성과 시트를 템플릿 형태(hidden)로만 출력합니다.

## 사전 준비

### 1. SA(검색광고) API 신청 — 광고주별 1회

네이버 검색광고 API는 **광고주 계정 단위로 별도 발급**됩니다. helloMAX처럼 여러 광고주를 운영하는 경우, 각 광고주 계정에서 개별 신청해야 합니다.

#### 1-1. 권한 확인

- API 신청 권한: 해당 광고주 계정의 **마스터(MASTER)** 또는 **슈퍼유저(SUPER_USER)** 권한 사용자만 가능
- 운영자(USER)/뷰어(VIEWER) 권한으로는 발급 불가 → 광고주에게 마스터 위임 또는 직접 발급 요청 필요

#### 1-2. 발급 절차

1. [네이버 검색광고 센터](https://ads.naver.com) 로그인 (해당 광고주 계정으로)
2. 우측 상단 사용자 메뉴 → **도구 > API 사용관리** 진입
3. **신규 등록** 버튼 클릭
   - 사용자 이름: 식별 가능한 라벨 (예: `helloMAX-mcp`)
   - 권한 범위: 모든 API 권한 ON (자동화 보고서·전환 데이터·메타데이터 조회용)
4. 생성 직후 화면에 표시되는 3개 값 즉시 보관:
   - `CUSTOMER_ID` — 광고주 ID (숫자, 영구 고정)
   - `ACCESS_LICENSE` — 액세스 라이선스
   - `SECRET_KEY` — **이 화면을 벗어나면 다시 볼 수 없음.** 별도 secret manager(1Password / Bitwarden / `accounts.json` 등)에 즉시 저장
5. 광고주 식별자(`client_id`)는 `accounts.json`의 account name과 동일하게 사용. 별도 매핑 파일 없음.

> ⚠️ `SECRET_KEY`를 분실한 경우 같은 사용자 항목에서 **키 재발급**으로 회전(아래 3절 참조). 기존 키는 폐기됩니다.

### 2. 자격증명 등록

자격증명은 두 가지 방식 중 하나로 등록할 수 있습니다 (우선순위 순):

#### A. `accounts.json` — 다중 광고주 (권장)

여러 광고주를 한 번에 관리할 수 있는 레지스트리. 프로젝트 루트에 `accounts.json`을 생성:

```json
{
  "default": "client-a",
  "accounts": {
    "client-a": {
      "customerId": "1234567",
      "accessLicense": "...",
      "secretKey": "..."
    },
    "client-b": {
      "customerId": "7654321",
      "accessLicense": "...",
      "secretKey": "..."
    }
  }
}
```

- `chmod 600 accounts.json` 권장 (다른 사용자 읽기 차단)
- 위치 변경: `NAVER_ADS_ACCOUNTS_PATH=/secure/path/accounts.json` 환경변수
- 계정 식별자(`client-a` 등)는 `^[a-zA-Z0-9_-]{1,64}$` 형식만 허용 — `naver-ads://accounts` 리소스 조회 시 식별자가 LLM transcript에 그대로 노출되므로, 노출돼도 무방한 라벨 사용 (광고주 코드명 또는 `acc1`/`client-001` 같은 opaque label)
- `accounts.json`은 `.gitignore`에 등록되어 있음 (절대 커밋 금지)
- account name이 `client_id` 그 자체. weekly/daily tool 호출 시 `{client: "client-a"}` 형태로 그대로 사용

#### B. `.env` 단일 광고주 — 레거시 fallback

`accounts.json`이 없으면 자동으로 단일 광고주 `default`로 동작:

```
NAVER_ADS_CUSTOMER_ID=your-customer-id
NAVER_ADS_ACCESS_LICENSE=your-access-license
NAVER_ADS_SECRET_KEY=your-secret-key
```

⚠️ `.env` 파일은 절대 커밋하지 않습니다. `.gitignore`에 이미 포함되어 있습니다.

### 3. Client별 키 운영 가이드

#### 3-1. 광고주 신규 온보딩 워크플로우

| 단계 | 담당   | 작업                                                                    |
| ---- | ------ | ----------------------------------------------------------------------- |
| 1    | AE     | 광고주에게 마스터 권한자에게 SA API 발급 요청 (계정명·발급자 이름 지정) |
| 2    | 광고주 | `ads.naver.com` → 도구 → API 사용관리 → 신규 등록 (위 1-2 절차)         |
| 3    | AE     | 발급 즉시 3개 값 secret manager에 저장 (이메일/메신저 전송 금지)        |
| 4    | AE     | `accounts.json`에 `client-X` 항목 추가 (account name = client_id)       |
| 5    | AE     | MCP 서버 재시작 → `validate_credentials({account: "client-X"})`로 검증  |

#### 3-2. 키 회전 (Key Rotation)

- **회전 트리거**: 키 유출 의심, 발급자 퇴사, 광고주 보안 정책 (분기/반기), `validate_credentials` 401 응답
- 절차: 네이버 검색광고 센터 → 도구 → API 사용관리 → 해당 사용자 항목 → **키 재발급** → 신규 `ACCESS_LICENSE`/`SECRET_KEY` 즉시 교체
- 회전 후 **MCP 서버 재시작 필수** (자격증명은 첫 도구 호출 시 한 번만 로드 — 핫리로드 없음)
- 재시작 후 `validate_credentials({account: "..."})` 도구로 검증 권장
- `CUSTOMER_ID`는 영구 고정 — 회전 대상 아님

#### 3-3. 광고주 오프보딩 (계약 종료)

1. 네이버 검색광고 센터에서 해당 사용자 항목 **삭제** (광고주 측 마스터가 수행)
2. `accounts.json`에서 해당 엔트리 제거 → MCP 서버 재시작 (이후 daily/weekly 호출 시 해당 client 자동 제외)
3. `./reports/{client}/`와 `~/.naver-ads-mcp/history/{client}/` 보관 정책에 따라 아카이브/삭제

#### 3-4. 다중 광고주 운영 시 주의사항

- 광고주별 키는 **계정 격리**됨 — `client-a`의 키로 `client-b` 데이터 조회 불가 (HTTP 403)
- 도구 호출 시 `account` 인자를 항상 명시: `generate_report({account: "client-a", ...})`. 미지정 시 `default` 광고주로 폴백되어 의도치 않은 데이터 혼선 가능
- `naver-ads://accounts` 리소스로 등록된 광고주 목록을 조회할 수 있으나 시크릿은 반환되지 않음

## 설치

```bash
npm install
npm run build
```

## 사용 방법

### 로컬 실행 (CLI)

```bash
npm start
```

표준입출력(stdio) 위에서 MCP 서버가 동작합니다.

운영 서버는 한국 날짜/주차 기준으로 동작해야 하므로 `TZ=Asia/Seoul`로 실행합니다. CLI는 `TZ`가 비어 있으면 자동으로 `Asia/Seoul`을 기본값으로 설정하지만, systemd/PM2/launchd 등 배포 환경에도 명시하는 것을 권장합니다.

### Claude Code에 MCP 서버로 등록

`~/.claude/settings.json` 또는 `.claude/settings.local.json`의 `mcpServers` 항목에 추가:

```json
{
  "mcpServers": {
    "naver-ads": {
      "command": "node",
      "args": ["/absolute/path/to/naver-ads-mcp/dist/cli.js"],
      "env": {
        "TZ": "Asia/Seoul",
        "NAVER_ADS_CUSTOMER_ID": "...",
        "NAVER_ADS_ACCESS_LICENSE": "...",
        "NAVER_ADS_SECRET_KEY": "..."
      }
    }
  }
}
```

또는 `.env`를 통해 환경변수를 주입:

```json
{
  "mcpServers": {
    "naver-ads": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/naver-ads-mcp/src/cli.ts"],
      "cwd": "/absolute/path/to/naver-ads-mcp"
    }
  }
}
```

## 제공하는 MCP Resources

읽기 전용 정적 데이터는 LLM 토큰 소비를 줄이기 위해 Tool이 아닌 Resource로 제공됩니다.

| URI                            | 반환                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| `naver-ads://report-types`     | 지원하는 10개 reportTp 목록 + 보관 기간 + 설명 (JSON)                               |
| `naver-ads://accounts`         | `{accounts: [{name, customerId}], default}` — 시크릿 미반환                         |
| `naver-ads://history/{client}` | 광고주별 prepare 이력 JSONL (week, payload_hash, prepared_at, html_path, xlsx_path) |

## 제공하는 MCP Tools (6개)

모든 도구는 선택적 `account?: string` 인자를 받습니다. 미지정 시 `accounts.json`의 `default` 광고주 (또는 legacy `.env`의 `default`) 사용. `client` = `account.name`.

| 도구                         | 인자                                                                                            | 반환                                                                                                                                           |
| ---------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `validate_credentials`       | `{account?}`                                                                                    | `{ok, message}` — 자격증명 유효성 검증                                                                                                         |
| `fetch_raw_data`             | `{account?, reportTp, startDate(YYYYMMDD), endDate(YYYYMMDD), outputPath?, summarize?, limit?}` | `{rows?, count, perDate, ...}`. 응답 >900KB 자동 가드 → hint                                                                                   |
| `generate_report`            | `{account?, startDate, endDate, outputPath?}`                                                   | `{path, sheetNames, visibility, rowCount}` — 10시트 xlsx 생성. `outputPath` 생략 시 `./reports/{account}/{account}_{startDate}_{endDate}.xlsx` |
| `prepare_weekly_payload`†    | `{account?, client, week, xlsxPath?, targetWeekLabel?, compareWeekLabel?}`                      | `{payload, payload_summary_md, system_prompt, user_prompt, expected_schema}` — Stage 1/2 (분석 prompt 동봉)                                    |
| `finalize_weekly_dashboard`† | `{account?, client, week, payload, ai_analysis, correction?}`                                   | `{artifact_html, html_path, xlsx_path, payload_hash, data_warnings}` — Stage 2/2                                                               |
| `prepare_daily_dashboard`    | `{date}`                                                                                        | `{date, violations, summary, data_warnings}` — 일별 KPI 임계치 점검 (Phase 3.5)                                                                |

† **v1.6 주간 보고서 2-stage 파이프라인** — 3가지 입력 경로 지원 (우선순위 순):

1. `payloadProvider` 주입 (test 전용)
2. `xlsxPath` + `targetWeekLabel` + `compareWeekLabel` (helloMAX form 수동 입력)
3. **live API** (기본 fallback) — `week`만 주면 ISO week → [week-1, week] 14일치 자동 fetch + aggregation. fetch는 동시성 cap으로 병렬화 (stat-report job 14일×2종).

호출 순서:

- (1) `prepare_weekly_payload({client, week:"2026-W21"})` → PrecomputedPayload + payload_summary_md + system/user prompt + expected_schema. **호스트 Claude가 동봉된 prompt를 직접 실행**해 `ai_analysis` 생성 (별도 prompt 생성 tool 없음)
- (2) `finalize_weekly_dashboard({client, week, payload, ai_analysis})` → AE preview artifact HTML + 광고주 발송용 html/xlsx → `./reports/{client}/{client}_{week}.{html,xlsx}` 저장 + history JSONL append

AE는 메일 클라이언트에서 그 파일들을 첨부해 광고주에게 직접 발송 (외부 Email MCP 의존 없음). 본 MCP 서버는 Anthropic SDK에 직접 의존하지 않음 — 분석은 호스트 LLM이 수행.

## 산출물 파일 경로 규칙

| Tool                              | 경로                                                       |
| --------------------------------- | ---------------------------------------------------------- |
| `generate_report` (default)       | `./reports/{account}/{account}_{startDate}_{endDate}.xlsx` |
| `generate_report` (사용자 지정)   | `args.outputPath` 그대로                                   |
| `finalize_weekly_dashboard`       | `./reports/{client}/{client}_{week}.{xlsx,html}`           |
| `prepare_daily_dashboard` history | `~/.naver-ads-mcp/history/{client}/{date}.jsonl`           |

> `./reports/`는 `.gitignore`에 등록 (커밋 금지). `reportsBaseDir`을 ServerDeps로 주입해 위치 변경 가능.

## 리포트 선택 가이드 (호스트 LLM용)

사용자가 "리포트 생성"이라고만 요청하면 두 옵션이 모호하므로 **반드시 사용자에게 어느 쪽인지 먼저 묻는다**:

| 옵션                            | 시트/내용                         | 용도                             | AI 분석                     |
| ------------------------------- | --------------------------------- | -------------------------------- | --------------------------- |
| **A. `generate_report`**        | 10시트 raw audit xlsx             | AE 내부 audit / 원시 데이터 확인 | ❌                          |
| **B. weekly 2-tool 파이프라인** | 3시트 발송용 xlsx + html artifact | 광고주 발송용 주간 대시보드      | ✅ (호스트 LLM이 직접 분석) |

호스트 LLM 권장 응답 예:

> "어떤 리포트 생성하시겠어요?
>
> 1. **Raw audit 엑셀** (10시트, 원시 데이터, 즉시 생성) — `generate_report`
> 2. **주간 대시보드** (KPI 요약 + AI 분석 + 광고주 발송용 html/xlsx) — weekly 2-stage 파이프라인"

## Artifact 렌더링 (Claude Desktop)

`finalize_weekly_dashboard` 결과의 `artifact_html` 필드는 **완성된 standalone HTML 문서**. Claude Desktop은 이 값을 채팅 텍스트로 paste하지 말고 **`type=text/html` artifact UI**로 렌더링한다 (AE preview 용).

`html_path` / `xlsx_path`는 호스트 머신 경로 — AE가 로컬 Finder/Explorer로 열어 광고주에게 첨부 발송.

## 사용 예 (Claude Desktop)

```jsonc
// 1. 빠른 raw audit xlsx (default 경로)
generate_report({startDate:"20260518", endDate:"20260524"})
// → ./reports/hellomax/hellomax_20260518_20260524.xlsx

// 2. 사용자 지정 경로
generate_report({startDate:"20260518", endDate:"20260524", outputPath:"/tmp/r.xlsx"})

// 3. 주간 보고서 자동 생성 (xlsx form 불필요) — 2-tool
prepare_weekly_payload({client:"hellomax", week:"2026-W21"})
// → payload + payload_summary_md + system_prompt/user_prompt/expected_schema
// → host LLM이 동봉된 prompt로 ai_analysis 직접 생성
finalize_weekly_dashboard({client:"hellomax", week:"2026-W21", payload, ai_analysis})
// → ./reports/hellomax/hellomax_2026-W21.{xlsx,html} + artifact_html

// 4. 데일리 KPI 점검 (모든 등록 account 순회)
prepare_daily_dashboard({date:"2026-05-20"})

// 5. 큰 raw 데이터 (1MB+) → 파일로 저장
fetch_raw_data({reportTp:"AD", startDate:"20260518", endDate:"20260524",
                outputPath:"/tmp/ad-w21.json"})
```

## 데이터 보관 기간 (Naver 공식)

| reportTp                                    | 보관        |
| ------------------------------------------- | ----------- |
| AD (광고효과보고서)                         | 365일       |
| AD_DETAIL (키워드 단위 운영)                | 180일       |
| AD_CONVERSION                               | 365일       |
| **AD_CONVERSION_DETAIL** (키워드 단위 전환) | **45일** ⚠️ |
| EXPKEYWORD (파워링크 검색어)                | 365일       |
| SHOPPINGKEYWORD_DETAIL                      | 180일       |
| SHOPPINGKEYWORD_CONVERSION_DETAIL           | 45일        |
| SHOPPINGBRANDPRODUCT                        | 365일       |
| SHOPPINGBRANDPRODUCT_CONVERSION             | 365일       |
| BRND_CONTRACT (브랜드검색)                  | 120일       |

⚠️ `AD_CONVERSION_DETAIL`이 45일밖에 보관되지 않으므로, 키워드 단위 전환 데이터를 365일치 누적 보관하려면 **매일 자동 수집(cron / GitHub Actions)** 이 필요합니다.

## 아키텍처

```
src/
├─ config/                  # L4: 자격증명 / account store
│  ├─ credentials.ts        # ICredentialLoader + EnvCredentialLoader (enumerable=false 시크릿)
│  └─ account-store.ts      # MapAccountStore (다중 광고주 레지스트리)
├─ api/                     # L3: HTTP/HMAC
│  ├─ signer.ts             # HMAC-SHA256 ({ts}.{method}.{path}) → base64
│  ├─ client.ts             # NaverAdsClient (401 retry, 5xx backoff, 429 Retry-After)
│  ├─ stat-reports.ts       # POST → poll → GZ/TSV
│  ├─ metadata.ts           # /ncc/campaigns, /ncc/adgroups, /ncc/keywords, /ncc/product-groups
│  └─ types.ts              # INaverAdsClient + DTO 정의
├─ raw/                     # L2: API → RawRowBase
│  ├─ builder.ts            # 공통 행 매핑 (VAT, 디바이스, 캠페인유형 한글화, conversion 4분류)
│  ├─ daily.ts / keyword.ts / search-term.ts / material.ts
├─ pivot/                   # L2: RAW → 5개 pivot 시트 데이터
├─ parser/                  # L2: helloMAX form 파서 + 주간/일간 aggregate
│  ├─ excel-template.ts     # parseHelloMaxXlsx
│  ├─ aggregate-payload.ts  # aggregateWeeklyPayload → PrecomputedPayload
│  └─ aggregate-daily.ts    # aggregateDailyPayload → DailyPayload
├─ analyzer/                # L2: weekly LLM prompt + threshold 규칙
│  ├─ weekly-prompt.ts      # buildSystemPrompt / buildUserPrompt / expected schema
│  └─ thresholds.ts         # daily KPI 임계 평가
├─ excel/                   # L2: 10시트 xlsx writer
│  └─ writer.ts             # ExcelJS 기반 (브랜드검색 hidden)
├─ output/                  # L1: 광고주 발송용 산출물
│  ├─ file-writer.ts        # ./reports/{client}/{client}_{week}.{html,xlsx} atomic write
│  ├─ weekly-html.ts        # 발송용 html (광고주 형식)
│  └─ weekly-xlsx.ts        # 발송용 xlsx (3-sheet)
├─ dashboard/               # L1: AE preview HTML
│  └─ artifact-html.ts
├─ runtime/                 # L1: 파일/락/history/account bootstrap
│  ├─ account-bootstrap.ts  # accounts.json 로더
│  ├─ history.ts            # prepare 이력 JSONL append/read
│  ├─ lock.ts               # (client, week) advisory lock
│  ├─ payload-hash.ts
│  └─ timezone.ts
├─ mcp/server.ts            # L1: MCP 서버 + 6 tools + 3 resources
├─ util/dates.ts            # 날짜/주차/ISO week 변환
├─ cli.ts                   # stdio 진입점
└─ index.ts                 # 라이브러리 export
```

## 개발

```bash
npm test            # 전체 테스트 실행 (vitest run)
npm run test:watch  # watch 모드
npm run typecheck   # tsc --noEmit
npm run build       # dist/ 컴파일
```

테스트 마커: 실 자격증명을 요구하는 테스트는 `credentials-required` 마커로 분리되어 CI에서 skip됩니다 (로컬에서 `RUN_LIVE=1 npm test`로 실행).

## 보안 정책

1. `.env`는 절대 커밋 금지 (`.gitignore` 등록 완료)
2. `EnvCredentialLoader`가 반환하는 객체의 `accessLicense`/`secretKey` 필드는 `enumerable: false`로 설정되어 `console.log()` / `JSON.stringify()`에 노출되지 않습니다
3. 에러 메시지에 자격증명 값을 포함하지 않습니다
4. HMAC 서명 시 `SECRET_KEY`는 헤더로 전송되지 않습니다 (서명 생성에만 사용)
5. **사용 종료 시 키 폐기**: 본 도구를 더 이상 사용하지 않으면 네이버 검색광고 센터에서 키 폐기

## 라이선스

UNLICENSED (사내 사용)
