# Security — Naver Ads MCP

## 자격증명 보호

### .env 비커밋 원칙

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

1. Naver 광고 시스템에서 새 API 키 발급
2. `.env` 파일의 `ACCESS_LICENSE`, `SECRET_KEY` 업데이트
3. MCP 서버 재시작 (Claude Code에서 연결 재시도)
4. `validate_credentials` tool 실행으로 유효성 확인

상세 절차: [README.md](../README.md) "키 로테이션" 섹션 참조

## 로컬 데이터 보호

- `docs/references/` — 실 광고주 템플릿 Excel. `.gitignore` + `.claudeignore` 등록
- `_workspace/` — 하네스 임시 작업 공간. `.gitignore` + `.claudeignore` 등록
- 생성된 Excel 보고서는 `output/` 디렉토리 (`.gitignore` 등록 권장)

## 의존성 보안

- `fetch`, `node:crypto` — Node.js native (별도 라이브러리 없음)
- 신규 npm 의존성 추가 시 PR 필수 + supply chain 검토
- `npm audit` 정기 실행 권장
