---
name: weekly-dashboard-3tool-flow
description: weekly dashboard 2-tool 흐름 (3→2 통합, 2026-05-29) — Anthropic 호출은 MCP에서 없고 host Claude가 직접 분석. C2 = 최소 2콜 floor
type: project
created: 2026-05-21
---

# Weekly Dashboard 2-tool 흐름 (2026-05-29 갱신; 원래 3-tool에서 통합)

## ⚡ 2026-05-29 — 3-tool → 2-tool 통합

`generate_weekly_analysis_prompt` tool 제거. system_prompt/user_prompt/expected_schema를 `prepare_weekly_payload` 반환에 동봉. round-trip(host LLM 턴) 1회 절감. MCP surface 7→6 tools.

새 흐름:

```
1. prepare_weekly_payload({client, week})
   → {payload, payload_summary_md, system_prompt, user_prompt, expected_schema}
   ※ host Claude가 동봉 prompt로 분석 → AiAnalysis JSON 작성
2. finalize_weekly_dashboard({client, week, payload, ai_analysis})
   → {artifact_html, html_path, xlsx_path, payload_hash, data_warnings}
```

## C2 제약 — 최소 2 tool call floor

host-LLM-중간-분석이 구조적으로 필요(tool1 → [host 분석 턴] → tool2). 1콜로 압축 = 분석을 서버가 해야 함 = C1(Anthropic 비의존) 위반. **2콜이 바닥, 그 아래 불가.** 통합은 floor를 안 깸. 관련: [[stat-report-latency-profile]] [[anthropic-data-transmission-policy]]

---

# (이력) 원래 3-tool 흐름 (v1.7)

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
