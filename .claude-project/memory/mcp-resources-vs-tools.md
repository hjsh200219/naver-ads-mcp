---
name: mcp-resources-vs-tools
description: read-only 메타데이터는 MCP resources로 노출 (system prompt 토큰 절감)
type: project
created: 2026-05-08
---

read-only 메타데이터 엔드포인트는 MCP tool이 아닌 MCP resource로 등록한다.

**Why:** `list_report_types`, `list_accounts`처럼 입력 없는 read-only 메타데이터를 tool로 등록하면 시스템 프롬프트의 tool list에 영구 등재되어 모든 대화에서 토큰을 소비한다. resources로 옮기면 tool list에 포함되지 않아 ~15-20% 시스템 프롬프트 토큰 절감. 도구 = "동작/부수효과", 리소스 = "참조/메타데이터" 분리는 MCP 설계 의도.

**How to apply:** 신규 read-only 메타데이터 노출은 `ListResourcesRequestSchema` + `ReadResourceRequestSchema` 핸들러로 등록. URI 컨벤션: `naver-ads://<resource-name>` (예: `naver-ads://report-types`, `naver-ads://accounts`). 입력 인자가 필요하거나 부수효과(파일 생성, 외부 API 호출)가 있으면 tool 유지. resource 추가 시 `tests/mcp.test.ts`의 resource 섹션에 테스트 추가 필수. 내부 헬퍼 함수와 `tools` 객체 export는 유지하면 기존 직접 호출 테스트가 깨지지 않음.
