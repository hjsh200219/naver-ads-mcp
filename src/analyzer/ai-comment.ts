// L2 service: drive Anthropic to produce a weekly AI analysis (review_text +
// insights + action_items + confidence + data_warnings). Enforces a
// hallucination guard: every number cited in review_text must appear in the
// precomputed payload, or confidence drops by 0.3.

import {
  AiAnalysisSchema,
  type AiAnalysis,
  type PrecomputedPayload,
} from "../parser/types.js";

export interface IAnthropic {
  generate(args: {
    system: string;
    user: string;
    cacheSystem?: boolean;
  }): Promise<{ content: string; cache_hit: boolean }>;
}

const HALLUCINATION_THRESHOLD = 0.95;
const HALLUCINATION_PENALTY = 0.3;

const NUM_REGEX = /-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?/g;

// Date/time context units that mark a number as a calendar reference, not a
// metric claim. The hallucination guard ignores numbers immediately followed
// by these so "4월 4주차" doesn't count as 4 fabricated metric mentions.
const DATE_UNIT_REGEX = /^(월|일|주차|주|년|시|분)/;

/**
 * Pull numeric tokens out of free-form Korean text that are *metric claims*.
 * Skips date references (e.g. "4월 4주차") because those are calendar context,
 * not values the AI needs to source from the payload.
 */
export function extractNumbers(text: string): number[] {
  const out: number[] = [];
  for (const match of text.matchAll(NUM_REGEX)) {
    const idx = match.index ?? 0;
    const after = text.slice(idx + match[0].length);
    if (DATE_UNIT_REGEX.test(after)) continue;
    const n = Number(match[0].replace(/,/g, ""));
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/**
 * Coverage = (cited numbers that appear in payload) / (cited numbers).
 * 1.0 means perfect alignment; 0.0 means everything was fabricated.
 */
export function hallucinationCoverage(
  cited: number[],
  payloadNumbers: ReadonlySet<number>,
): number {
  if (cited.length === 0) return 1;
  const tolerance = 0.5; // accept rounding within 0.5 (e.g. 33.4 vs 33.39)
  let supported = 0;
  for (const n of cited) {
    if (payloadNumbers.has(n)) {
      supported++;
      continue;
    }
    let matched = false;
    for (const p of payloadNumbers) {
      if (Math.abs(p - n) <= tolerance) {
        matched = true;
        break;
      }
    }
    if (matched) supported++;
  }
  return supported / cited.length;
}

export function applyHallucinationPenalty(
  rawConfidence: number,
  coverage: number,
): number {
  if (coverage >= HALLUCINATION_THRESHOLD) return rawConfidence;
  return Math.max(0, rawConfidence - HALLUCINATION_PENALTY);
}

/**
 * Walk every numeric value in the payload and collect them into a Set so the
 * hallucination guard can check membership.
 */
function collectPayloadNumbers(payload: PrecomputedPayload): Set<number> {
  const out = new Set<number>();
  const visit = (v: unknown): void => {
    if (typeof v === "number" && Number.isFinite(v)) {
      out.add(v);
      out.add(Math.round(v));
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(visit);
      return;
    }
    if (v && typeof v === "object") {
      Object.values(v as Record<string, unknown>).forEach(visit);
    }
  };
  visit(payload);
  return out;
}

/**
 * Few-shot example sourced from docs/references/hellomax_weekly_comment_sample.html
 * (비셰프 4월 4주차). The numbers are real reference data; the AI uses this as
 * a tone/format guide. The hallucination guard still applies to the production
 * prompt's payload, so this example does not contaminate downstream coverage.
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

export const SYSTEM_PROMPT = [
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
].join("\n");

export interface GenerateArgs {
  anthropic: IAnthropic;
  payload: PrecomputedPayload;
  retries?: number;
}

export async function generateAiComment({
  anthropic,
  payload,
  retries = 3,
}: GenerateArgs): Promise<AiAnalysis> {
  const userPrompt = JSON.stringify(payload);

  let lastErr: unknown;
  let raw: string | undefined;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const r = await anthropic.generate({
        system: SYSTEM_PROMPT,
        user: userPrompt,
        cacheSystem: true,
      });
      raw = r.content;
      break;
    } catch (err) {
      lastErr = err;
      const status = (err as { status?: number }).status;
      if (status !== undefined && status < 500 && status !== 429) {
        throw err;
      }
      if (attempt === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, 50 * Math.pow(2, attempt)));
    }
  }
  if (raw === undefined) {
    throw lastErr instanceof Error
      ? lastErr
      : new Error("Anthropic call failed");
  }

  const parsed: unknown = JSON.parse(raw);
  const validated = AiAnalysisSchema.parse(parsed);

  // Hallucination guard
  const cited = extractNumbers(validated.review_text);
  const payloadNumbers = collectPayloadNumbers(payload);
  const coverage = hallucinationCoverage(cited, payloadNumbers);
  const adjustedConfidence = applyHallucinationPenalty(
    validated.confidence,
    coverage,
  );

  return {
    ...validated,
    confidence: adjustedConfidence,
  };
}
