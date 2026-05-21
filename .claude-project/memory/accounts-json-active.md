---
name: accounts-json-active
description: accounts.json이 단일 자격증명 소스로 운영 중 (commit df096e5 이후 client-mappings.json 삭제)
type: reference
created: 2026-05-08
updated: 2026-05-21
---

`accounts.json`이 이 프로젝트의 활성 자격증명 소스 + 클라이언트 식별. `.env`는 마이그레이션 후 삭제됨. `client-mappings.json` 폐기 (commit df096e5).

**핵심 관계:**

- `account.name` (kebab-case) == `client_id` (MCP에서 참조하는 고유 식별자)
- 예: `accounts.json`에 `"hellomax": {...}`가 있으면 `client_id="hellomax"`로 operate

**Why:** 다중 광고주 레지스트리 도입 후, 보고서 메타(display_name, recipients, cc)의 대부분은 외부 Email MCP가 담당하므로 client-mappings.json이 불필요. 자격증명 + client 식별을 accounts.json 단일 소스로 통합하여 동기화 부담 제거.

**How to apply:**

- **자격증명 회전**: `accounts.json`의 해당 계정 항목 수정 → MCP 서버 재시작 (핫리로드 미지원)
- **추가 광고주 등록**: `accounts.json`의 `accounts` 객체에 신규 키 추가 (사용할 client_id로 명명) → 재시작
- **클라이언트 식별**: `prepare_daily_dashboard` → `getStore().list()` 순회 → `account.name` lookup (register_client tool 제거됨)
- **`.env` 재생성 금지** — env fallback은 동작하지만 단일 소스 원칙 위반. 다른 환경 변수(API 키 등) 필요하면 `NAVER_ADS_*` 제외 후 신규 `.env` 생성 무방
- **등록 계정**: 현재 `hellomax` (default) 1개. customerId는 `accounts.json` 또는 `naver-ads://accounts` 리소스로 확인
- **계정 키 컨벤션**: 클라이언트 슬러그(`hellomax`, `clientB` 등). `primary`/`secondary`는 다중 광고주 식별 시 혼동되므로 자제
- **파일 보안**: `.gitignore` 등록됨 → 절대 commit 금지. `chmod 600` 권한 유지 (group/other 접근 시 stderr 경고)
- **절대경로 필수**: Claude Desktop MCP config의 `cwd`가 일부 환경에서 무시되므로 `env.NAVER_ADS_ACCOUNTS_PATH` 절대경로로 명시 (cwd 의존 금지)

관련: [[multi-account-architecture]], [[config-single-source-principle]].
