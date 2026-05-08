# 네이버 검색광고 MCP 서버 (helloMAX 보고서 자동화)

## 무엇을 하는가

네이버 검색광고 API를 통해 helloMAX 광고주의 운영·전환 데이터를 수집하고, **`(FORM) helloMAX Report.xlsx` 템플릿과 동일한 10시트 구조의 엑셀**을 자동 생성하는 MCP 서버입니다.

| 구분 | 시트 | 자동화 방식 |
|---|---|---|
| 표시(Pivot) | SUMMARY, 매체별 성과, 키워드 성과, 상품 성과, 검색어 성과 | 클라이언트 측 집계 |
| 표시(템플릿 placeholder) | **브랜드검색 성과** | ⚠️ **API 미지원** — placeholder 시트 (수기 입력) |
| 원천(RAW) | 일별RAW, 키워드RAW, 검색어RAW, 소재RAW | `/stat-reports` API |

## 브랜드검색 성과 시트는 왜 자동화되지 않는가

네이버 검색광고 공식 답변 (GitHub Issue [#1072](https://github.com/naver/searchad-apidoc/issues/1072)):
> "해당 지표는 소재관리화면에서만 제공되며 별도 리포트로 제공되지 않습니다."

브랜드검색 광고의 영역별 성과(홈링크/메인이미지/타이틀/섬네일.1~9 등)는 `ads.naver.com`의 소재관리 화면에서만 확인 가능하며, API로는 제공되지 않습니다. 따라서 본 MCP는 브랜드검색 성과 시트를 템플릿 형태(hidden)로만 출력합니다.

## 사전 준비

### 1. API 키 발급
1. [네이버 검색광고 센터](https://manage.searchad.naver.com) 로그인
2. 도구 → API 사용관리 → API 사용자 생성
3. 다음 3개 값 발급:
   - `CUSTOMER_ID`
   - `ACCESS_LICENSE`
   - `SECRET_KEY`

### 2. `.env` 작성
프로젝트 루트의 `.env.example`을 참고하여 `.env` 파일을 생성:
```
NAVER_ADS_CUSTOMER_ID=your-customer-id
NAVER_ADS_ACCESS_LICENSE=your-access-license
NAVER_ADS_SECRET_KEY=your-secret-key
```

⚠️ `.env` 파일은 절대 커밋하지 않습니다. `.gitignore`에 이미 포함되어 있습니다.

### 3. 키 회전 (Key Rotation) 절차
- 키 유출이 의심되거나 발급자 퇴사 시 즉시 회전
- 절차: 네이버 검색광고 센터 → 도구 → API 사용관리 → 기존 키 폐기 → 새 키 발급 → `.env` 업데이트
- 회전 후 `npm start`로 서버 재기동 후 `validate_credentials` 도구로 검증 권장

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
      "args": ["/absolute/path/to/zebra-brothers-ae/dist/cli.js"],
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
      "args": ["tsx", "/absolute/path/to/zebra-brothers-ae/src/cli.ts"],
      "cwd": "/absolute/path/to/zebra-brothers-ae"
    }
  }
}
```

## 제공하는 MCP Tools

| 도구 | 인자 | 반환 |
|---|---|---|
| `validate_credentials` | 없음 | `{ok, message}` — 자격증명 유효성 검증 |
| `list_report_types` | 없음 | 지원하는 10개 reportTp 목록 + 보관 기간 + 설명 |
| `fetch_raw_data` | `{reportTp, startDate(YYYYMMDD), endDate(YYYYMMDD)}` | `{rows, count, reportTp}` |
| `generate_report` | `{startDate, endDate, outputPath}` | `{path, sheetNames, visibility, rowCount}` — 10시트 xlsx 생성 |

## 데이터 보관 기간 (Naver 공식)

| reportTp | 보관 |
|---|---|
| AD (광고효과보고서) | 365일 |
| AD_DETAIL (키워드 단위 운영) | 180일 |
| AD_CONVERSION | 365일 |
| **AD_CONVERSION_DETAIL** (키워드 단위 전환) | **45일** ⚠️ |
| EXPKEYWORD (파워링크 검색어) | 365일 |
| SHOPPINGKEYWORD_DETAIL | 180일 |
| SHOPPINGKEYWORD_CONVERSION_DETAIL | 45일 |
| SHOPPINGBRANDPRODUCT | 365일 |
| SHOPPINGBRANDPRODUCT_CONVERSION | 365일 |
| BRND_CONTRACT (브랜드검색) | 120일 |

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
│  └─ server.ts            # MCP 서버 + 4개 도구
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
