// L2 service: weekly AI analysis prompt builders. The MCP host (Claude desktop)
// drives the analysis directly — this module only constructs the system/user
// prompts and exports the expected JSON-schema for the AI output.

import type { PrecomputedPayload } from "../parser/types.js";

/**
 * Few-shot example sourced from docs/references/hellomax_weekly_comment_sample.html
 * (비셰프 4월 4주차). Acts as a tone/format guide; the production payload still
 * supplies the numbers that must be cited.
 */
const FEW_SHOT_EXAMPLE = `예시 출력 형식 (참고용 톤·구조):
{
  "review_text": "안녕하세요, 비셰프 담당자님.\\n\\n4월 4주차(4/20~4/26) 광고 운영 결과를 안내 드립니다.\\n\\n금주 총 광고비 457,614원(VAT 미포함) 집행 대비 매출 2,362,980원을 달성하여 전체 ROAS 516%로 마감하였습니다. 전주 대비 매출은 +32.1% 증가하였으나 광고비 증가폭(+39.4%)이 더 커 ROAS는 소폭 하락(▼5.3%p)하였습니다.\\n\\n▶ 파워링크 — 전체 ROAS 173%, 모바일 효율(38%) 개선이 필요합니다.\\n▶ 쇼핑검색 — 전체 ROAS 946%, 모바일이 금주 성과를 견인하였습니다.\\n\\n다음 주 주요 최적화 방향을 함께 안내 드리오니 검토 부탁드립니다.",
  "insights": [
    {"type":"good","title":"쇼핑검색 모바일 ROAS 1,075%","body":"클릭 +73.9%, 전환 +41.9% 동반 성장. 모바일 예산 비중 확대 시 추가 매출 여지 있음.","metrics":["모바일 전환 44건","ROAS 1,075%","매출 1,843,380원"]},
    {"type":"bad","title":"파워링크 모바일 ROAS 38%","body":"비용 185,139원 대비 전환 3건. 임계치 이하로 입찰가 조정 또는 예산 축소 필요.","metrics":["모바일 비용 185,139원","전환 3건","ROAS 38%"]}
  ],
  "action_items": [
    {"title":"파워링크 모바일 입찰가 하향 조정","description":"모바일 ROAS 38%는 효율 임계치 이하. 입찰 CPC 20~30% 하향, 3일간 전환 모니터링.","priority":"high"},
    {"title":"쇼핑검색 모바일 일예산 상향 검토","description":"ROAS 1,075% 고효율 유지 중. 일예산 10~20% 상향 후 잔여 예산 확인.","priority":"high"}
  ],
  "confidence": 0.85,
  "data_warnings": []
}`;

const SYSTEM_PROMPT_LINES = [
  "당신은 네이버 검색광고 및 쇼핑검색 전문 분석가입니다. HelloMax AI 광고 운영 플랫폼의 AE 업무를 지원합니다.",
  "광고주는 중소형 사업자입니다. 실무적이고 간결한 한국어를 사용하세요.",
  "출력은 JSON 형식으로만 반환합니다: { review_text, insights[], action_items[], confidence, data_warnings[] }.",
  "review_text는 광고주에게 전달될 주간 성과 리뷰입니다 (인사말 포함, 정중하고 전문적). 2~4문단.",
  "insights는 AE 내부 참고용 인사이트 (최대 5건). 각 항목: type(good/warn/bad/info), title, body, metrics(짧은 문구 배열).",
  "action_items는 다음 주 권장 액션 (3~6건). 각 항목: title, description, priority(high/mid/low).",
  "절대 수치를 계산하지 마세요. 입력 데이터의 값만 인용하세요. 불확실한 수치는 추측하지 말 것.",
  "confidence는 0~1 사이의 신뢰도. 데이터 누락·이상값이 보이면 0.7 미만으로 낮추세요.",
  "data_warnings는 입력 데이터의 이상값·누락 항목을 짧게 기록하세요 (없으면 빈 배열).",
  "",
  FEW_SHOT_EXAMPLE,
];

export function buildSystemPrompt(): string {
  return SYSTEM_PROMPT_LINES.join("\n");
}

export function buildUserPrompt(payload: PrecomputedPayload): string {
  return JSON.stringify(payload);
}

/**
 * JSON Schema (hand-authored, mirrors AiAnalysisSchema in parser/types.ts).
 * Returned to the MCP host so it knows the exact shape Claude must emit.
 */
export const EXPECTED_AI_ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "review_text",
    "insights",
    "action_items",
    "confidence",
    "data_warnings",
  ],
  properties: {
    review_text: { type: "string" },
    insights: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "title", "body", "metrics"],
        properties: {
          type: { type: "string", enum: ["good", "warn", "bad", "info"] },
          title: { type: "string" },
          body: { type: "string" },
          metrics: { type: "array", items: { type: "string" } },
        },
      },
    },
    action_items: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description", "priority"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: ["high", "mid", "low"] },
        },
      },
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    data_warnings: { type: "array", items: { type: "string" } },
  },
} as const;

// ---------------------------------------------------------------------------
// payload_summary_md — compact human-readable digest the MCP host can drop
// straight into Claude's context window.
// ---------------------------------------------------------------------------

function fmtPct(n: number, digits = 2): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

function fmtInt(n: number): string {
  return n.toLocaleString("ko-KR");
}

export function buildPayloadSummaryMd(payload: PrecomputedPayload): string {
  const cur = payload.kpi_current;
  const wow = payload.kpi_wow;
  const lines: string[] = [];
  lines.push(`# ${payload.advertiser} 주간 성과 요약`);
  lines.push(
    `- 분석 기간: ${payload.report_period.start} ~ ${payload.report_period.end}`,
  );
  lines.push(
    `- 비교 기간: ${payload.compare_period.start} ~ ${payload.compare_period.end}`,
  );
  lines.push("");
  lines.push("## 전체 KPI (전주 대비)");
  lines.push(
    `- 노출수: ${fmtInt(cur.impressions)} (${fmtPct(wow.impressions_pct)})`,
  );
  lines.push(`- 클릭수: ${fmtInt(cur.clicks)} (${fmtPct(wow.clicks_pct)})`);
  lines.push(`- 광고비: ${fmtInt(cur.cost)}원 (${fmtPct(wow.cost_pct)})`);
  lines.push(
    `- 전환수: ${fmtInt(cur.conversions)}건 (${fmtPct(wow.conversions_pct)})`,
  );
  lines.push(`- 매출액: ${fmtInt(cur.revenue)}원 (${fmtPct(wow.revenue_pct)})`);
  lines.push(`- ROAS: ${cur.roas.toFixed(0)}% (${fmtPct(wow.roas_pct)})`);
  if (payload.media.length > 0) {
    lines.push("");
    lines.push("## 매체별 (TOTAL)");
    for (const m of payload.media) {
      const total = m.rows.find((r) => r.device === "TOTAL");
      if (!total) continue;
      lines.push(
        `- ${m.label}: ROAS ${total.roas.toFixed(0)}% (전주 ${fmtPct(m.wow.roas_pct, 1)})`,
      );
    }
  }
  if (payload.data_warnings.length > 0) {
    lines.push("");
    lines.push("## 데이터 경고");
    for (const w of payload.data_warnings) lines.push(`- ${w}`);
  }
  return lines.join("\n");
}
