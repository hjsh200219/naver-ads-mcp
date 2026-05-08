# Security — Naver Ads MCP

## 자격증명 저장소

자격증명은 두 가지 경로 중 하나로 로드된다 (우선순위 순):

1. **`accounts.json`** — 다중 광고주 레지스트리 (권장)
2. **`.env` 단일 계정 환경변수** — 레거시 fallback (`accounts.json` 부재 시)

### accounts.json 운영 규칙

- 절대 커밋 금지. `.gitignore`에 등록되어 있다.
- 권장 권한: `chmod 600 accounts.json` — 다른 사용자 읽기 차단
- 서버 시작 시 권한이 `0o077` 비트 중 하나라도 설정되어 있으면 (예: 0644) stderr 경고
- 클라우드 동기화 폴더(Dropbox, iCloud Drive, OneDrive 등)에 두지 말 것
- 위치 변경: `NAVER_ADS_ACCOUNTS_PATH=/secure/path/accounts.json` 환경변수
- 키 회전 시 파일 갱신 후 **MCP 서버 재시작 필수** (핫리로드 없음)

### MCP 도구 transcript 노출 (잔여 위험)

`account` 인자는 LLM 도구 호출 페이로드에 포함되어 다음에 기록될 수 있다:

- LLM 대화 transcript (Claude Code 등 MCP 호스트의 conversation log)
- MCP 호스트가 자체 운영하는 도구 호출 분석/감사 로그

**완화 조치**:

- account 식별자는 `^[a-zA-Z0-9_-]{1,64}$` 정규식 검증. 특수문자/한글/점 등 거부.
- 광고주 실명 노출이 우려되면 opaque label 권장 (예: `acc1`, `client-001`)
- 검증 실패 응답: `"Invalid account identifier"` 고정 — 입력값 미반사
- `AccountNotFoundError`도 입력값/계정 목록 미반사

### .env 비커밋 원칙 (legacy single-account)

- `.env` 파일은 `.gitignore`에 등록 완료 (절대 커밋 금지)
- `.env.example`만 커밋 (실제 값 없이 키 이름만 포함)
- CI/CD 환경에서는 환경 변수로 주입

### enumerable=false 패턴

`src/config/credentials.ts`의 `accessLicense`/`secretKey` 필드는 `enumerable: false`로 정의:

```typescript
Object.defineProperty(credentials, "secretKey", {
  value: process.env.SECRET_KEY,
  enumerable: false, // JSON.stringify, console.log 등에서 누출 방지
  writable: false,
  configurable: false,
});
```

**효과**: `JSON.stringify(credentials)`, `console.log(credentials)`, `Object.keys(credentials)` 에서 자격증명 값이 노출되지 않음.

## HMAC 서명 보안

### SECRET_KEY 비전송 원칙

- `X-Timestamp`, `X-API-KEY` 헤더만 전송
- `SECRET_KEY`는 서명 생성에만 사용하고 **절대 헤더에 포함하지 않음**

### HMAC payload 형식

```
{timestamp}.{HTTP_METHOD}.{path-without-query}
```

예: `1699999999000.GET./ncc/campaigns`

- 쿼리스트링은 payload에 포함하지 않음 (Naver API 명세 준수)
- timestamp는 요청 시점 Unix milliseconds

## 에러 메시지 보안

자격증명 값을 에러 메시지에 포함 금지:

```typescript
// 금지
throw new Error(`인증 실패: secretKey=${this.secretKey}`);

// 권장
throw new NaverAdsApiError("인증 실패 (401). 자격증명을 확인하세요.", {
  status: 401,
});
```

## 키 회전 절차

### `accounts.json` 사용 시

1. 네이버 검색광고 센터 → 도구 → API 사용관리 → 새 키 발급
2. `accounts.json`의 해당 광고주 항목을 새 값으로 갱신 (mode 0600 유지)
3. MCP 서버 재시작 (Claude Code 재실행 또는 MCP 재연결)
4. `validate_credentials({account: "..."})` tool 실행으로 유효성 확인
5. 기존 키 폐기

### `.env` legacy 사용 시

1. Naver 광고 시스템에서 새 API 키 발급
2. `.env` 파일의 `ACCESS_LICENSE`, `SECRET_KEY` 업데이트
3. MCP 서버 재시작 (Claude Code에서 연결 재시도)
4. `validate_credentials` tool 실행으로 유효성 확인

> **자격증명은 첫 도구 호출 시점에 한 번만 로드된다. 핫리로드 없음 — 회전 시 반드시 재시작.**

상세 절차: [README.md](../README.md) "키 로테이션" 섹션 참조

## 로컬 데이터 보호

- `docs/references/` — 실 광고주 템플릿 Excel. `.gitignore` + `.claudeignore` 등록
- `_workspace/` — 하네스 임시 작업 공간. `.gitignore` + `.claudeignore` 등록
- 생성된 Excel 보고서는 `output/` 디렉토리 (`.gitignore` 등록 권장)

## 의존성 보안

- `fetch`, `node:crypto` — Node.js native (별도 라이브러리 없음)
- 신규 npm 의존성 추가 시 PR 필수 + supply chain 검토
- `npm audit` 정기 실행 권장
