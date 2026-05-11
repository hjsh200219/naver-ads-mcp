# 네이버 검색광고 MCP 서버 (helloMAX 보고서 자동화)

## 무엇을 하는가

네이버 검색광고 API를 통해 helloMAX 광고주의 운영·전환 데이터를 수집하고, **`(FORM) helloMAX Report.xlsx` 템플릿과 동일한 10시트 구조의 엑셀**을 자동 생성하는 MCP 서버입니다.

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
5. 광고주 코드명(`client_id`) 매핑은 [`src/config/client-mappings.json`](src/config/client-mappings.json)에 기록

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
- `accounts.json`의 `client-a` 식별자는 [`src/config/client-mappings.json`](src/config/client-mappings.json)의 `client_id`와 **동일하게 유지** (조회 일관성)

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

| 단계 | 담당   | 작업                                                                           |
| ---- | ------ | ------------------------------------------------------------------------------ |
| 1    | AE     | 광고주에게 마스터 권한자에게 SA API 발급 요청 (계정명·발급자 이름 지정)        |
| 2    | 광고주 | `ads.naver.com` → 도구 → API 사용관리 → 신규 등록 (위 1-2 절차)                |
| 3    | AE     | 발급 즉시 3개 값 secret manager에 저장 (이메일/메신저 전송 금지)               |
| 4    | AE     | `accounts.json`에 `client-X` 항목 추가 + `client-mappings.json`에 매핑 행 추가 |
| 5    | AE     | MCP 서버 재시작 → `validate_credentials({account: "client-X"})`로 검증         |

#### 3-2. 키 회전 (Key Rotation)

- **회전 트리거**: 키 유출 의심, 발급자 퇴사, 광고주 보안 정책 (분기/반기), `validate_credentials` 401 응답
- 절차: 네이버 검색광고 센터 → 도구 → API 사용관리 → 해당 사용자 항목 → **키 재발급** → 신규 `ACCESS_LICENSE`/`SECRET_KEY` 즉시 교체
- 회전 후 **MCP 서버 재시작 필수** (자격증명은 첫 도구 호출 시 한 번만 로드 — 핫리로드 없음)
- 재시작 후 `validate_credentials({account: "..."})` 도구로 검증 권장
- `CUSTOMER_ID`는 영구 고정 — 회전 대상 아님

#### 3-3. 광고주 오프보딩 (계약 종료)

1. `client-mappings.json`에서 `automation_enabled: false` 설정 → 데일리/위클리 잡 자동 제외
2. 네이버 검색광고 센터에서 해당 사용자 항목 **삭제** (광고주 측 마스터가 수행)
3. `accounts.json`에서 해당 엔트리 제거 → MCP 서버 재시작
4. `~/.naver-ads-mcp/reports/{client}/` 와 `~/.naver-ads-mcp/history/{client}/` 보관 정책에 따라 아카이브/삭제

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

### Claude Code에 MCP 서버로 등록

`~/.claude/settings.json` 또는 `.claude/settings.local.json`의 `mcpServers` 항목에 추가:

```json
{
  "mcpServers": {
    "naver-ads": {
      "command": "node",
      "args": ["/absolute/path/to/naver-ads-mcp/dist/cli.js"],
      "env": {
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

| URI                        | 반환                                                        |
| -------------------------- | ----------------------------------------------------------- |
| `naver-ads://report-types` | 지원하는 10개 reportTp 목록 + 보관 기간 + 설명 (JSON)       |
| `naver-ads://accounts`     | `{accounts: [{name, customerId}], default}` — 시크릿 미반환 |

## 제공하는 MCP Tools

모든 도구는 선택적 `account?: string` 인자를 받습니다. 미지정 시 `accounts.json`의 `default` 광고주 (또는 legacy `.env`의 `default`) 사용.

| 도구                        | 인자                                                                                      | 반환                                                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `validate_credentials`      | `{account?}`                                                                              | `{ok, message}` — 자격증명 유효성 검증                                                                              |
| `fetch_raw_data`            | `{account?, reportTp, startDate(YYYYMMDD), endDate(YYYYMMDD)}`                            | `{rows, count, reportTp}`                                                                                           |
| `generate_report`           | `{account?, startDate, endDate, outputPath}`                                              | `{path, sheetNames, visibility, rowCount}` — 10시트 xlsx 생성                                                       |
| `prepare_weekly_dashboard`† | `{client, week, xlsxPath?, targetWeekLabel?, compareWeekLabel?, revisions?, correction?}` | `{artifact_html, html_path, xlsx_path, payload_hash, data_warnings}` — AE 검토용 artifact + 광고주 발송용 html/xlsx |

† v1.6 추가. AE가 `xlsxPath`(helloMAX form)를 업로드하면 `targetWeekLabel`(예: `"2026-05-04주차"`) + `compareWeekLabel`로 주간 KPI를 집계, Anthropic Claude를 호출해 review/insights/actions 생성, AE 검토용 artifact HTML과 광고주 발송용 html/xlsx 파일 두 개를 `~/.naver-ads-mcp/reports/{client}/{week}.{html|xlsx}`에 저장합니다. AE는 메일 클라이언트에서 그 파일들을 첨부해 광고주에게 직접 발송합니다 (외부 Email MCP 의존 없음). 자세한 흐름과 책임 분리는 `docs/exec-plans/active/weekly-report-automation-plan.md` v1.6을 참조하세요.

### v1.6 추가 리소스

| URI                            | 내용                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| `naver-ads://client-mappings`  | 광고주 매핑 (client_id, display_name, customer_id) — recipients/cc는 PII 마스킹     |
| `naver-ads://history/{client}` | 광고주별 prepare 이력 JSONL (week, payload_hash, prepared_at, html_path, xlsx_path) |

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
├─ config/credentials.ts   # ICredentialLoader + EnvCredentialLoader (enumerable=false 시크릿)
├─ api/
│  ├─ signer.ts            # HMAC-SHA256 ({ts}.{method}.{path}) → base64
│  ├─ client.ts            # NaverAdsClient (401 retry, 5xx backoff, 429 Retry-After)
│  ├─ stat-reports.ts      # POST → poll → GZ → TSV
│  ├─ metadata.ts          # /ncc/campaigns, /ncc/adgroups, /ncc/keywords, /ncc/product-groups
│  └─ types.ts             # INaverAdsClient + DTO 정의
├─ raw/
│  ├─ builder.ts           # 공통 행 매핑 (VAT, 디바이스, 캠페인유형 한글화)
│  ├─ daily.ts             # 일별RAW (17 cols)
│  ├─ keyword.ts           # 키워드RAW (18 cols)
│  ├─ search-term.ts       # 검색어RAW (18 cols)
│  └─ material.ts          # 소재RAW (20 cols)
├─ pivot/
│  ├─ aggregate.ts         # safeDiv, weightedAvgRank, groupAggregate
│  ├─ summary.ts           # SUMMARY 시트
│  ├─ media.ts             # 매체별 성과 (월별+주차별)
│  ├─ keyword.ts           # 키워드 성과
│  ├─ product.ts           # 상품 성과
│  └─ search-term.ts       # 검색어 성과
├─ excel/
│  ├─ headers.ts           # 4개 RAW 시트 한글 헤더 상수
│  └─ writer.ts            # ExcelJS 기반 10시트 xlsx 생성
├─ mcp/
│  └─ server.ts            # MCP 서버 + 3개 도구 + 2개 리소스
├─ util/
│  └─ dates.ts             # 월별/주차/날짜 정규화
├─ cli.ts                  # stdio 진입점
└─ index.ts                # 라이브러리 export
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
