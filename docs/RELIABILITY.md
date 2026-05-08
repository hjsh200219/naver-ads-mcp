# Reliability — Naver Ads MCP

## Naver API 재시도 정책

### 401 Unauthorized

- **원인**: HMAC 서명 만료 또는 타임스탬프 스큐
- **정책**: 1회 재서명 후 재시도. 재시도도 401이면 `NaverAdsApiError(401)` throw
- **주의**: 자격증명 자체가 잘못된 경우 재시도 무의미 → 에러 메시지로 구분

### 5xx Server Error

- **정책**: Exponential backoff 3회 재시도
  - 1차: 1초 대기
  - 2차: 2초 대기
  - 3차: 4초 대기
  - 3회 모두 실패 시 마지막 에러 throw
- **대상**: 500, 502, 503, 504

### 429 Too Many Requests

- **정책**: `Retry-After` 헤더 값(초) 만큼 대기 후 재시도
- `Retry-After` 없으면 기본 60초 대기
- 재시도는 1회만 (무한 루프 방지)

## StatReport 비동기 흐름

Naver 통계 보고서는 동기 API가 아닌 비동기 큐 방식:

```
POST /stats/  →  보고서 ID 발급
  ↓
GET /stats/{id}  →  상태 폴링 (WAITING / RUNNING / COMPLETED / FAILED)
  ↓ (COMPLETED)
GET /stats/{id}/download  →  GZ 파일 다운로드
  ↓
파싱: GZ → TSV → JavaScript 객체
```

### 폴링 정책

- **초기 대기**: 1초
- **백오프 캡**: 최대 30초 (초기 1s → 2s → 4s → ... → 30s 상한)
- **타임아웃**: 총 10분 초과 시 `Error('StatReport timeout')` throw
- **FAILED 상태**: 즉시 에러 throw (폴링 계속 없음)

## AD_CONVERSION_DETAIL 45일 보관 한계

Naver API의 전환 상세 데이터(`AD_CONVERSION_DETAIL`)는 **45일치만 보관**.

**영향**: 45일 이전 전환 데이터는 API로 조회 불가.

**권장 운영 방식**:

- 매일 cron으로 전날 데이터 수집 → 로컬/S3에 누적 저장
- 현재 MCP server는 on-demand 수집만 지원 (누적 저장 미구현)
- 관련 부채: [tech-debt-tracker.md](./exec-plans/tech-debt-tracker.md) #2

## 에러 분류 기준

`NaverAdsApiError`의 `status` 필드:

| status | 의미                 | 조치                              |
| ------ | -------------------- | --------------------------------- |
| 400    | 잘못된 요청 파라미터 | 요청 검토 후 수정                 |
| 401    | 인증 실패            | 1회 재서명, 실패 시 자격증명 확인 |
| 403    | 권한 없음            | 계정 권한 확인 (재시도 불가)      |
| 404    | 리소스 없음          | ID 확인                           |
| 429    | 요청 과다            | Retry-After 대기                  |
| 5xx    | 서버 오류            | Exp backoff 3회 재시도            |

## 알려진 한계

1. **단일 광고주 계정**: `.env` 기반 단일 자격증명만 지원
2. **메모리 내 처리**: 대용량 TSV (수백만 행) 스트리밍 미지원
3. **네트워크 오류**: `fetch` 자체 실패(DNS, timeout)는 Node.js 기본 에러로 throw
