---
name: reports-path-convention
description: generate_report 기본 출력 경로 + weekly/daily 파일명 규칙 통일 (commit a2fa57a)
type: project
created: 2026-05-21
---

# Reports Path Convention (commit a2fa57a)

## 문제

기존:

- `generate_report` outputPath 필수 → 사용자 매번 경로 지정
- weekly 파일명 불일치 (`<week>.xlsx` vs `<client>_<week>.xlsx`)
- REPORTS_BASE_DIR 하드코딩 (`~/.naver-ads-mcp/reports`) → 프로젝트 루트와 무관

결과: 산출물 흩어짐, 파일명 불일치, 자동화 불편.

## 해결책 (commit a2fa57a)

### 1. 기본 출력 경로

```typescript
// src/mcp/server.ts — generate_report tool
const REPORTS_BASE_DIR = process.cwd() + "/reports"; // 기존: ~/.naver-ads-mcp/reports

if (!outputPath) {
  outputPath = `${REPORTS_BASE_DIR}/${account}/${account}_${startDate}_${endDate}.xlsx`;
}
```

**규칙:**

```
./reports/
  <account>/
    <account>_<startDate>_<endDate>.xlsx  (generate_report raw audit)
    <client>_<week>.xlsx                  (weekly dashboard)
    <client>_<week>.html                  (weekly artifact)
    <client>_<YYYY-MM-DD>.xlsx            (daily dashboard)
    <client>_<YYYY-MM-DD>.html            (daily artifact)
```

**장점:**

- 프로젝트 루트 `./reports/` → git clone 후 바로 사용 가능
- 계정별 폴더 분리 → 다중 광고주 관리 용이
- 파일명 일관성 → 스크립트 자동화 가능

### 2. 파일명 규칙 통일

commit a2fa57a: `file-writer.ts` 업데이트

```typescript
// 기존: <week>.{xlsx,html}
// 신규: <client>_<week>.{xlsx,html}
const weeklyXlsxPath = `${dir}/${client}_${week}.xlsx`;
const weeklyHtmlPath = `${dir}/${client}_${week}.html`;

// 일별도 동일
const dailyXlsxPath = `${dir}/${client}_${YYYY - MM - DD}.xlsx`;
const dailyHtmlPath = `${dir}/${client}_${YYYY - MM - DD}.html`;
```

**이점:**

- 다중 클라이언트 환경에서 파일명으로 즉시 인식
- 메일 발송 시 `<client>_<week>` 패턴으로 자동 분류 가능
- 중복 파일명 방지

### 3. .gitignore 추가

```
/reports/
```

→ 산출물(민감 정보) 버전 관리 제외

## 동작 흐름

### Raw Audit (generate_report)

```bash
# outputPath 생략 시 자동
generate_report({
  account: 'acme',
  startDate: '2026-05-01',
  endDate: '2026-05-31'
})
# 출력: ./reports/acme/acme_2026-05-01_2026-05-31.xlsx
```

### Weekly Dashboard (3-tool flow)

```bash
# 1. prepare_weekly_payload (outputPath 불필요)
prepare_weekly_payload({
  client: 'acme',
  week: '2026-W21'
})

# 2. generate_weekly_analysis_prompt + AI 분석 (Claude host)

# 3. finalize_weekly_dashboard
finalize_weekly_dashboard({
  client: 'acme',
  week: '2026-W21',
  payload: {...},
  ai_analysis: {...}
})
# 출력:
#   ./reports/acme/acme_W21.xlsx
#   ./reports/acme/acme_W21.html
```

### Daily Dashboard (Phase 3.5)

```bash
prepare_daily_dashboard({
  client: 'acme',
  date: '2026-05-21'
})
# 출력:
#   ./reports/acme/acme_2026-05-21.xlsx
#   ./reports/acme/acme_2026-05-21.html
```

## 다중 광고주 구조

accounts.json 다중 계정 시:

```
./reports/
  acme/
    acme_2026-05-01_2026-05-31.xlsx
    acme_W21.xlsx
    acme_W21.html
  globex/
    globex_2026-05-01_2026-05-31.xlsx
    globex_W21.xlsx
    globex_W21.html
```

## 검증 (commit a2fa57a)

- `tests/file-writer.test.ts`: 파일명 규칙 검증
- `README.md` 신규 섹션: "Output Paths" + 5 케이스 사용 예
- vitest: 354/354 passing
- build: OK

## Do's & Don'ts

- ✓ outputPath 생략해서 기본 경로 사용 (자동화 권장)
- ✓ 다중 계정 시 각각 separate 폴더
- ✓ 자동화 스크립트는 `./reports/<account>/<account>_*` 패턴으로 파일 추적
- ✗ 수동으로 outputPath 지정 (기본값 우선)
- ✗ reports/ 폴더를 git commit (민감 정보 + 재현성 방해)
- ✗ 파일명 규칙 변경 (downstream 자동화 깨짐)

## 마이그레이션

기존 workflows → 신규:

1. outputPath 지정 코드 제거 → 기본값 사용
2. 스크립트의 파일명 패턴 업데이트 (`<week>` → `<client>_<week>`)
3. 산출물 경로 재지정 (e.g., S3, Email) 시 `./reports/` 하위 구조 반영

관련: [[weekly-live-api-path]], [[mcp-1mb-response-limit]], [[weekly-dashboard-3tool-flow]].
