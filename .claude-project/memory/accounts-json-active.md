---
name: accounts-json-active
description: accounts.json이 단일 자격증명 소스로 운영 중 (.env 제거됨)
type: reference
created: 2026-05-08
---

`accounts.json`이 이 프로젝트의 활성 자격증명 소스. `.env`는 마이그레이션 후 삭제됨.

**Why:** 다중 광고주 레지스트리(`multi-account-architecture.md`) 도입 후, 단일 광고주만 운영해도 `.env` + `accounts.json` 이중 보유는 키 회전 시 동기화 부담. 사용자 결정으로 `.env`를 제거하고 `accounts.json`만 단일 소스로 운영.

**How to apply:**

- 자격증명 회전: `accounts.json`의 해당 계정 항목만 수정 후 MCP 서버 재시작 (핫리로드 미지원)
- 추가 광고주 등록: `accounts.json`의 `accounts` 객체에 신규 키 추가 후 재시작
- **`.env` 재생성 금지** — env fallback은 동작하지만 단일 소스 원칙 위반. 만일 다른 환경 변수(API 키 등) 필요하면 `accounts.json`과 충돌 안 하므로 신규 `.env`는 무방하나 `NAVER_ADS_*`는 절대 추가 금지
- 마이그레이션 시점 등록 계정: `primary` (default) 1개. customerId는 `accounts.json` 또는 `list_accounts` MCP 호출로 확인
- `accounts.json`은 `.gitignore` 등록됨 — 절대 commit 금지. `chmod 600` 권한 유지 (group/other 접근 시 stderr 경고 발생)
