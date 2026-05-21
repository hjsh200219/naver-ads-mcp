---
name: weekly-dashboard-3tool-flow
description: prepare_weekly_dashboard가 3-tool로 분리됨 — Anthropic 호출은 MCP 서버에서 사라지고 host Claude가 직접 분석 담당
type: project
created: 2026-05-21
---

# Weekly Dashboard 3-tool 흐름 (v1.7)

## 변경 사유

기존 `prepare_weekly_dashboard`는 MCP 서버가 자체 Anthropic API 호출로 분석 수행. 사용자 결정: **분석은 host Claude(desktop)가 직접 하고 MCP는 raw 데이터/prompt/finalize만 담당**.

이유:

- ANTHROPIC_API_KEY 별도 발급/관리 불필요
- @anthropic-ai/sdk 의존성 제거
- Hallucination guard 로직 제거 (Claude 신뢰)
- AE 워크플로 단순화

## 3-tool 흐름

```
1. prepare_weekly_payload({client, week, xlsxPath, targetWeekLabel, compareWeekLabel})
   → {payload: PrecomputedPayload, payload_summary_md: string}

2. generate_weekly_analysis_prompt({payload})
   → {system_prompt, user_prompt, expected_schema}
   ※ Claude(host)가 이 prompt로 분석 → AiAnalysis JSON 작성

3. finalize_weekly_dashboard({client, week, payload, ai_analysis})
   → {artifact_html, html_path, xlsx_path, payload_hash, data_warnings}
   ※ ai_analysis zod 검증 → writeReportFiles + appendHistory + renderArtifactHtml
   ※ AE가 html/xlsx 메일 클라이언트에 첨부해 광고주 발송
```

## 제거된 코드

- `src/api/anthropic.ts` (Anthropic SDK 래퍼)
- `src/config/anthropic-credentials.ts` (ANTHROPIC_API_KEY 로더)
- `src/analyzer/ai-comment.ts` (generateAiComment + hallucination guard)
- `tests/anthropic-credentials.test.ts`
- `tests/ai-comment.test.ts`
- `@anthropic-ai/sdk` dependency (package.json)

## 신규 코드

- `src/analyzer/weekly-prompt.ts` — `buildSystemPrompt`, `buildUserPrompt`, `buildPayloadSummaryMd`, `EXPECTED_AI_ANALYSIS_SCHEMA`

## **Why:** MCP는 데이터/orchestration 책임만, LLM 호출은 host 위임. Anthropic 자격증명 분리·중앙 관리 가능. 비용·debugging Claude desktop 한 곳에 집중.

## **How to apply:** weekly dashboard 작업 시 3-tool 순서 준수. AiAnalysis 시그니처(review_text/insights/action_items/confidence/data_warnings)는 `AiAnalysisSchema` 그대로 유지 — Tool 3 zod 검증.
