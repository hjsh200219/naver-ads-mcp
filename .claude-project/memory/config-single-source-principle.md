---
name: config-single-source-principle
description: 단일 소스 원칙 — accounts.json으로 자격증명 + 클라이언트 메타 통합 (commit df096e5)
type: project
created: 2026-05-21
---

**결정:**
commit df096e5에서 `client-mappings.json` 폐기. 자격증명(accounts.json) + 클라이언트 식별(account.name == client_id)을 단일 소스로 통합.

**Trade-off:**

- **손실 메타**: daily_thresholds override, automation_enabled, display_name, notes
- **이유**: 이메일 수신자 목록(PII)은 외부 Email MCP가 담당하므로 client-mappings의 주요 필드 불필요. 중복 저장소 유지의 복잡성(sync drift, race condition) > 폐기 비용
- **향후 확장**: daily_thresholds 재도입 시 (1) accounts.json 스키마 확대 또는 (2) 별도 경량 config 도입

**패턴 영향:**

- `register_client` tool 삭제 → 클라이언트 등록 = accounts.json manual edit + server restart
- `prepare_daily_dashboard` → `getStore().list()` → `account.name` lookup (더 이상 mapping 조회 불필요)
- `naver-ads://client-mappings` resource 삭제 (4→3 resources)
- weekly tool warnings 제거 (mapping 없는 게 정상)

**검증 (commit df096e5):**

- typecheck: 0 errors
- vitest: 346/346 passing
- build: OK
- 삭제: 1,303 lines (client-mappings 관련 코드 + 206 test cases)

**Do's & Don'ts:**

- ✓ accounts.json 키로 고유 client_id 부여 (kebab-case)
- ✓ 다중 광고주 시 각각 account 항목 추가
- ✗ client-mappings.json 재도입 (이미 폐기됨, git history만 남음)
- ✗ PII(recipients, cc)를 accounts.json에 저장 → 보안 위험

관련: [[accounts-json-active]], [[multi-account-architecture]].
