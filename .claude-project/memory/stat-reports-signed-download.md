---
name: stat-reports-signed-download
description: 네이버 stat-report 다운로드 URL은 HMAC 서명 필수 + v2 응답은 비압축 plain TSV
type: project
created: 2026-05-21
---

# Stat-Report 다운로드 — 서명 + gzip 조건부

## 사실 (실측 2026-05-21)

네이버 Search Ad API stat-report 비동기 흐름:

1. POST `/stat-reports` `{reportTp, statDt}` → `{reportJobId, status}`
2. GET `/stat-reports/{reportJobId}` 폴링 → status `BUILT` 시 `downloadUrl` (절대 URL)
3. GET `downloadUrl` → TSV 데이터

**다운로드 URL은 HMAC 서명 필수**:

- 서명 안 하면 400 + `{"header":"X-API-KEY","status":400,"type":"urn:naver:api:problem:missing-header"}`
- 서명 payload는 path-only (query string 제외): `{ts}.GET.{pathname}` (예: `/report-download`)

**v2 응답은 plain TSV (비압축)**:

- `fileVersion=v2` URL 응답 → magic byte `32 30 32 36` (`"2026"`, 날짜)
- gzip magic byte `1f 8b` 아님
- v1은 gzip일 수 있음 (확인 안 됨, 안전 위해 magic-byte 조건부 분기)

## 구현 (src/api/client.ts, stat-reports.ts)

```ts
// client.ts
async downloadBinary(absoluteUrl: string): Promise<Buffer> {
  const path = new URL(absoluteUrl).pathname;
  const authHeaders = this._signer({...credentials, method: "GET", uri: path});
  const response = await this._fetch(absoluteUrl, {method: "GET", headers: {...authHeaders}});
  if (!response.ok) throw new NaverAdsApiError(`Download failed (${response.status})`, ...);
  return Buffer.from(await response.arrayBuffer());
}

// stat-reports.ts
const buf = await client.downloadBinary(downloadUrl);
const isGzip = buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
const tsvText = (isGzip ? gunzipSync(buf) : buf).toString("utf-8");
```

## **Why:** 8주간 "incorrect header check" 에러로 fetch_raw_data 불가, generate_report는 catch-swallow로 빈 데이터 출력. 두 버그 동시 발견.

## **How to apply:** 향후 새 stat-report 관련 작업 시 downloadBinary 사용. 서명 path는 항상 URL pathname (query 제외). gzip 강제 가정 금지.
