# Naver Ads MCP — Agent Guide

> 본 문서는 에이전트 진입점입니다. 상세 규칙은 docs/ 하위 문서를 참조하세요.

## 응답 스타일

Be concise. No filler. Straight to the point. Use fewer words.

## 세션 시작 시 필수

새 세션 시작 시 다음 파일을 반드시 읽어 이전 세션 컨텍스트를 파악한다:

1. `.claude-project/HANDOFF.md` — 이전 세션 인계서
2. `.claude-project/memory/MEMORY.md` — 프로젝트 메모리 인덱스

## 프로젝트 개요

TypeScript MCP server that automates Naver Search Ad data collection and generates the helloMAX 10-sheet Excel report. Brand search 영역별 성과는 Naver API 미지원으로 placeholder. (참조: GitHub Issue naver/searchad-apidoc#1072)

## Tech Stack (요약)

| 계층     | 기술                                       |
| -------- | ------------------------------------------ |
| Runtime  | Node.js 20+                                |
| Language | TypeScript 5 (strict, NodeNext)            |
| MCP      | @modelcontextprotocol/sdk                  |
| Excel    | exceljs                                    |
| HTTP     | fetch (native) + node:crypto (HMAC-SHA256) |
| Test     | vitest                                     |

## Architecture (Quick Reference)

> 상세: [ARCHITECTURE.md](./ARCHITECTURE.md)

5계층 구조 (의존 방향: L1 → L2 → L3 → L4 → L5):

- **L5 Types**: `src/api/types.ts`, `src/pivot/types.ts`
- **L4 Config**: `src/config/credentials.ts`
- **L3 API**: `src/api/{client,signer,stat-reports,metadata}.ts`
- **L2 Service**: `src/{raw,pivot,excel,util,analyzer,parser}/`
- **L1 Runtime**: `src/{mcp/server,cli,index}.ts`
  - MCP surface (v1.6 + Phase 3.5): **6 tools** (`validate_credentials`, `fetch_raw_data`, `generate_report`, `prepare_weekly_payload`, `finalize_weekly_dashboard`, `prepare_daily_dashboard`) + **3 resources** (`naver-ads://report-types`, `naver-ads://accounts`, `naver-ads://history/{client}`). 자격증명과 client 식별 모두 `accounts.json` 단일 소스. client_id = account name. 별도 client-mappings 파일 없음 (이메일 수신자 등 PII는 외부 Email MCP 책임). `prepare_daily_dashboard`는 `accounts.json`의 모든 entry를 순회 — global default thresholds 적용. `fetch_raw_data`는 1MB 응답 한도 대응 옵션 제공 (`outputPath` → 파일 저장 후 path+count 반환, `summarize` → row 생략, `limit` → row 캡, 자동 가드 >900KB hint). 주간 보고서 파이프라인은 2-tool 구조: (1) `prepare_weekly_payload` live API(기본) 또는 helloMAX form xlsx → PrecomputedPayload + payload_summary_md + system/user prompt + expected schema (분석 prompt 동봉, 호스트 LLM이 직접 분석), (2) `finalize_weekly_dashboard` payload + ai_analysis → AE preview artifact + 광고주 발송용 html/xlsx + history JSONL. live API fetch는 동시성 cap(`CONCURRENT_STAT_JOBS`)으로 병렬화 (14일×2종 stat-report job, poll initialDelay 250ms). 발송은 AE가 메일 클라이언트에서 직접 첨부 (외부 Email MCP 의존 없음). MCP 서버는 Anthropic SDK에 의존하지 않습니다 — 분석은 호출 측 Claude(host)가 수행합니다.

## Health Stack

| 명령                | 용도                       |
| ------------------- | -------------------------- |
| `npm run typecheck` | TypeScript 검증 (0 errors) |
| `npm test`          | vitest run (359 passing)   |
| `npm run build`     | tsc → dist/                |

## Critical Constraints

- `.env`·`accounts.json`은 절대 commit 금지. `.gitignore` 등록 완료
- `accounts.json`은 `chmod 600` 유지. 변경 후 MCP 서버 재시작 필수 (핫리로드 미지원)
- `accessLicense`/`secretKey` 필드는 `enumerable: false` (자격증명 비누출)
- HMAC payload는 `{ts}.{METHOD}.{path-no-query}` 정확 매치
- SECRET_KEY는 헤더 미전송 (서명 생성 전용)
- 브랜드검색 영역별 성과 시트는 항상 hidden (API 미지원)

## LLM 코딩 행동 원칙

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

Tradeoff: These guidelines bias toward caution over speed. For trivial tasks, use judgment.

1. Think Before Coding — Don't assume. Don't hide confusion. Surface tradeoffs. State assumptions explicitly; if multiple interpretations exist, present them; if simpler approach exists, say so; if unclear, stop and ask.
2. Simplicity First — Minimum code that solves the problem. No speculative features, no single-use abstractions, no unrequested configurability, no error handling for impossible scenarios. If 200 lines could be 50, rewrite it.
3. Surgical Changes — Touch only what you must. Don't improve adjacent code. Match existing style. Mention unrelated dead code but don't delete it. Remove only imports/vars/functions YOUR changes made unused.
4. Goal-Driven Execution — Transform tasks into verifiable goals (write failing test first, then make it pass). For multi-step tasks, state a plan with verify steps. Loop independently until criteria met.

## Documentation Map

| 영역        | 문서                                                                                                                         |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 아키텍처    | [ARCHITECTURE.md](./ARCHITECTURE.md), [docs/design-docs/layer-rules.md](./docs/design-docs/layer-rules.md)                   |
| 품질·안정성 | [docs/QUALITY.md](./docs/QUALITY.md), [docs/RELIABILITY.md](./docs/RELIABILITY.md)                                           |
| 보안        | [docs/SECURITY.md](./docs/SECURITY.md)                                                                                       |
| 제품 원칙   | [docs/PRODUCT_SENSE.md](./docs/PRODUCT_SENSE.md), [docs/design-docs/core-beliefs.md](./docs/design-docs/core-beliefs.md)     |
| 계획·부채   | [docs/PLANS.md](./docs/PLANS.md), [docs/exec-plans/tech-debt-tracker.md](./docs/exec-plans/tech-debt-tracker.md)             |
| 하네스      | [docs/harness/principles.md](./docs/harness/principles.md), [docs/harness/harness-setup.md](./docs/harness/harness-setup.md) |
| 사용 가이드 | [README.md](./README.md)                                                                                                     |

## Pre-Implementation Checklist

> 상세: [docs/harness/harness-setup.md](./docs/harness/harness-setup.md)

핵심 5개:

1. TDD: 새 기능은 실패하는 테스트 먼저 작성
2. 함수 50줄 이하, 매개변수 4개 이하, 중첩 3단계 이내
3. import 방향 준수 (L1 ← L2 ← L3 ← L4 ← L5)
4. 자격증명은 절대 로그·에러·toString에 노출 금지
5. 새 기능 추가 시 기존 패턴(`enumerable=false`, HMAC 서명, retry semantics) 재활용

## Status Protocol

작업 종료 시 다음 중 하나로 보고:

- `DONE` — 모든 acceptance criteria 충족
- `DONE_WITH_CONCERNS` — 완료되었으나 follow-up 필요
- `BLOCKED` — 외부 의존성으로 차단
- `NEEDS_CONTEXT` — 명확화 필요
