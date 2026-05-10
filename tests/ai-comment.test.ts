import { describe, it, expect } from "vitest";
import {
  extractNumbers,
  hallucinationCoverage,
  applyHallucinationPenalty,
  generateAiComment,
  type IAnthropic,
} from "../src/analyzer/ai-comment.js";
import type { AiAnalysis, PrecomputedPayload } from "../src/parser/types.js";

const SAMPLE_PAYLOAD: PrecomputedPayload = {
  advertiser: "비셰프",
  industry: "식품/밀키트",
  report_period: { start: "2026-04-20", end: "2026-04-26" },
  compare_period: { start: "2026-04-13", end: "2026-04-19" },
  kpi_current: {
    impressions: 112_415,
    clicks: 699,
    cost: 457_614,
    conversions: 55,
    revenue: 2_362_980,
    roas: 516,
  },
  kpi_previous: {
    impressions: 94_505,
    clicks: 524,
    cost: 328_172,
    conversions: 48,
    revenue: 1_789_321,
    roas: 545,
  },
  kpi_wow: {
    impressions_pct: 18.95,
    clicks_pct: 33.4,
    cost_pct: 39.44,
    conversions_pct: 14.58,
    revenue_pct: 32.06,
    roas_pct: -5.29,
  },
  media: [
    {
      media: "powerlink",
      label: "파워링크",
      rows: [
        {
          device: "TOTAL",
          impressions: 51_031,
          clicks: 320,
          cost: 254_467,
          conversions: 9,
          revenue: 440_500,
          roas: 173,
        },
      ],
      wow: {
        impressions_pct: 1,
        clicks_pct: 13.9,
        cost_pct: 13.0,
        conversions_pct: 0,
        revenue_pct: 1.3,
        roas_pct: -10.4,
      },
    },
    {
      media: "shopping",
      label: "쇼핑검색",
      rows: [
        {
          device: "TOTAL",
          impressions: 61_384,
          clicks: 379,
          cost: 203_146,
          conversions: 46,
          revenue: 1_922_480,
          roas: 946,
        },
      ],
      wow: {
        impressions_pct: 39.6,
        clicks_pct: 56.0,
        cost_pct: 97.4,
        conversions_pct: 17.9,
        revenue_pct: 41.9,
        roas_pct: -28.1,
      },
    },
  ],
  data_warnings: [],
};

describe("US-015 hallucination guard helpers", () => {
  it("extractNumbers picks integers, decimals, and Korean-suffixed values", () => {
    const text =
      "총 광고비 457,614원, ROAS 516%, 매출 2,362,980원으로 마감했습니다. 전주 대비 +32.06%.";
    const nums = extractNumbers(text);
    expect(nums).toEqual(expect.arrayContaining([457614, 516, 2362980, 32.06]));
  });

  it("extractNumbers tolerates 만원 / 건 suffixes", () => {
    const text = "매출 236만원, 전환 55건";
    const nums = extractNumbers(text);
    expect(nums).toEqual(expect.arrayContaining([236, 55]));
  });

  it("hallucinationCoverage = 1.0 when every cited number is in payload", () => {
    const numbers = [112_415, 699, 457_614, 55, 2_362_980];
    const payloadNumbers = new Set([112_415, 699, 457_614, 55, 2_362_980, 516]);
    expect(hallucinationCoverage(numbers, payloadNumbers)).toBeCloseTo(1, 5);
  });

  it("hallucinationCoverage = 0.5 when half the cited numbers are unsupported", () => {
    const numbers = [100, 200, 300, 400];
    const payloadNumbers = new Set([100, 200]);
    expect(hallucinationCoverage(numbers, payloadNumbers)).toBeCloseTo(0.5, 5);
  });

  it("applyHallucinationPenalty drops confidence by 0.3 below 95% threshold", () => {
    expect(applyHallucinationPenalty(0.9, 0.94)).toBeCloseTo(0.6, 5);
    expect(applyHallucinationPenalty(0.9, 0.96)).toBeCloseTo(0.9, 5);
  });

  it("applyHallucinationPenalty floors at 0", () => {
    expect(applyHallucinationPenalty(0.2, 0.5)).toBe(0);
  });
});

describe("US-015 generateAiComment with mock anthropic client", () => {
  const validResponse: AiAnalysis = {
    review_text:
      "안녕하세요. 4월 4주차 광고 운영 결과 광고비 457,614원 대비 매출 2,362,980원으로 ROAS 516% 달성했습니다.",
    insights: [
      {
        type: "good",
        title: "쇼핑검색 모바일 강세",
        body: "쇼핑검색 매출 1,922,480원, ROAS 946%.",
        metrics: ["매출 1,922,480원", "ROAS 946%"],
      },
      {
        type: "bad",
        title: "파워링크 모바일 비효율",
        body: "비용 254,467원에 비해 전환 9건.",
        metrics: ["비용 254,467원", "전환 9건"],
      },
      {
        type: "info",
        title: "전주 대비 추세",
        body: "노출 +18.95%, 클릭 +33.4%.",
        metrics: ["노출 +18.95%", "클릭 +33.4%"],
      },
    ],
    action_items: [
      {
        title: "파워링크 모바일 입찰 하향",
        description: "비효율 시간대 입찰 조정.",
        priority: "high",
      },
      {
        title: "쇼핑검색 모바일 일예산 상향",
        description: "고효율 매체에 추가 예산 배분.",
        priority: "high",
      },
      {
        title: "PC 입찰 전략 유지",
        description: "현재 효율 유지 모니터링.",
        priority: "low",
      },
    ],
    confidence: 0.85,
    data_warnings: [],
  };

  function mockOk(response: AiAnalysis): IAnthropic {
    return {
      generate: async () => ({
        content: JSON.stringify(response),
        cache_hit: true,
      }),
    };
  }

  it("returns the parsed AI analysis on a clean response", async () => {
    const out = await generateAiComment({
      anthropic: mockOk(validResponse),
      payload: SAMPLE_PAYLOAD,
    });
    expect(out.review_text).toContain("ROAS");
    expect(out.insights).toHaveLength(3);
    expect(out.action_items).toHaveLength(3);
    expect(out.confidence).toBeGreaterThan(0);
  });

  it("preserves confidence at or above 0.95 hallucination coverage", async () => {
    const out = await generateAiComment({
      anthropic: mockOk(validResponse),
      payload: SAMPLE_PAYLOAD,
    });
    expect(out.confidence).toBeCloseTo(0.85, 5);
  });

  it("penalizes confidence by 0.3 when review_text has fabricated numbers", async () => {
    const fabricated: AiAnalysis = {
      ...validResponse,
      review_text:
        "광고비 999,999원 대비 매출 8,888,888원으로 ROAS 7777% 달성했습니다.", // none of these are in payload
    };
    const out = await generateAiComment({
      anthropic: mockOk(fabricated),
      payload: SAMPLE_PAYLOAD,
    });
    expect(out.confidence).toBeCloseTo(0.55, 1);
  });

  it("retries on 5xx and surfaces the success path", async () => {
    let attempts = 0;
    const flaky: IAnthropic = {
      generate: async () => {
        attempts++;
        if (attempts < 2) {
          const e = new Error("server error") as Error & { status: number };
          e.status = 500;
          throw e;
        }
        return { content: JSON.stringify(validResponse), cache_hit: false };
      },
    };
    const out = await generateAiComment({
      anthropic: flaky,
      payload: SAMPLE_PAYLOAD,
    });
    expect(attempts).toBe(2);
    expect(out.review_text).toBeDefined();
  });

  it("rejects an unparseable AI response", async () => {
    const broken: IAnthropic = {
      generate: async () => ({ content: "not json", cache_hit: false }),
    };
    await expect(
      generateAiComment({ anthropic: broken, payload: SAMPLE_PAYLOAD }),
    ).rejects.toThrow();
  });

  it("rejects an AI response missing required fields", async () => {
    const partial: IAnthropic = {
      generate: async () => ({
        content: JSON.stringify({ review_text: "x" }),
        cache_hit: false,
      }),
    };
    await expect(
      generateAiComment({ anthropic: partial, payload: SAMPLE_PAYLOAD }),
    ).rejects.toThrow();
  });
});
