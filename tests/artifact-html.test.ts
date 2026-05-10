import { describe, it, expect } from "vitest";
import { renderArtifactHtml } from "../src/dashboard/artifact-html.js";
import type { AiAnalysis, PrecomputedPayload } from "../src/parser/types.js";

const payload: PrecomputedPayload = {
  advertiser: "비셰프",
  industry: "식품/밀키트",
  report_period: { start: "2026-04-20", end: "2026-04-26" },
  compare_period: { start: "2026-04-13", end: "2026-04-19" },
  kpi_current: {
    impressions: 112415,
    clicks: 699,
    cost: 457614,
    conversions: 55,
    revenue: 2362980,
    roas: 516,
  },
  kpi_previous: {
    impressions: 94505,
    clicks: 524,
    cost: 328172,
    conversions: 48,
    revenue: 1789321,
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
          impressions: 51031,
          clicks: 320,
          cost: 254467,
          conversions: 9,
          revenue: 440500,
          roas: 173,
        },
        {
          device: "PC",
          impressions: 11861,
          clicks: 101,
          cost: 69328,
          conversions: 6,
          revenue: 369400,
          roas: 533,
        },
        {
          device: "MO",
          impressions: 39170,
          clicks: 219,
          cost: 185139,
          conversions: 3,
          revenue: 71100,
          roas: 38,
        },
      ],
      wow: {
        impressions_pct: 1,
        clicks_pct: 13.9,
        cost_pct: 13,
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
          impressions: 61384,
          clicks: 379,
          cost: 203146,
          conversions: 46,
          revenue: 1922480,
          roas: 946,
        },
      ],
      wow: {
        impressions_pct: 39.6,
        clicks_pct: 56,
        cost_pct: 97.4,
        conversions_pct: 17.9,
        revenue_pct: 41.9,
        roas_pct: -28.1,
      },
    },
  ],
  data_warnings: [],
};

const ai: AiAnalysis = {
  review_text:
    "안녕하세요. 4월 4주차 광고비 457,614원 대비 매출 2,362,980원으로 ROAS 516%.",
  insights: [
    {
      type: "good",
      title: "쇼핑검색 모바일 강세",
      body: "모바일 ROAS 1,075%.",
      metrics: ["ROAS 1,075%"],
    },
    {
      type: "bad",
      title: "파워링크 모바일 비효율",
      body: "비용 185,139원에 전환 3건.",
      metrics: ["전환 3건"],
    },
    {
      type: "info",
      title: "전주 대비",
      body: "ROAS -5.29% 하락.",
      metrics: ["ROAS -5.29%"],
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
      description: "고효율 매체에 추가 배분.",
      priority: "high",
    },
    {
      title: "PC 입찰 유지",
      description: "효율 유지 모니터링.",
      priority: "low",
    },
  ],
  confidence: 0.85,
  data_warnings: [],
};

describe("US-015 artifact-html (AE preview, AC: snapshot structure)", () => {
  const html = renderArtifactHtml({ payload, ai });

  it("returns a self-contained HTML document (no external fetch)", () => {
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
    // No external network references
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).not.toMatch(/<link[^>]+href=["']https?:/);
    expect(html).not.toMatch(/<img[^>]+src=["']https?:/);
  });

  it("contains the advertiser, period, and AE-mode badges", () => {
    expect(html).toContain("비셰프");
    expect(html).toContain("2026-04-20");
    expect(html).toContain("2026-04-26");
    expect(html).toContain("AI 생성");
  });

  it("contains exactly 6 KPI cards (impressions/clicks/cost/conversions/revenue/roas)", () => {
    const cardMatches = html.match(/class="kpi-card[^"]*"/g) ?? [];
    expect(cardMatches.length).toBe(6);
  });

  it("renders both media blocks (파워링크 + 쇼핑검색)", () => {
    expect(html).toContain("파워링크");
    expect(html).toContain("쇼핑검색");
    const mediaCards = html.match(/class="media-card"/g) ?? [];
    expect(mediaCards.length).toBe(2);
  });

  it("renders >= 3 insights and >= 3 action items (AC: AE preview minimum)", () => {
    const insightItems = html.match(/class="insight-item"/g) ?? [];
    const actionItems = html.match(/class="action-item"/g) ?? [];
    expect(insightItems.length).toBeGreaterThanOrEqual(3);
    expect(actionItems.length).toBeGreaterThanOrEqual(3);
  });

  it("emits >= 100 DOM-tag-like nodes (AC: complexity floor)", () => {
    const tags = html.match(/<[a-zA-Z][^>]*>/g) ?? [];
    expect(tags.length).toBeGreaterThanOrEqual(100);
  });

  it("hides confidence badge when >= 0.7", () => {
    expect(html).not.toMatch(/confidence-warn/);
  });

  it("shows confidence badge when < 0.7", () => {
    const lowAi: AiAnalysis = { ...ai, confidence: 0.5 };
    const lowHtml = renderArtifactHtml({ payload, ai: lowAi });
    expect(lowHtml).toMatch(/confidence-warn/);
  });

  it("escapes review text to prevent script injection", () => {
    const evilAi: AiAnalysis = {
      ...ai,
      review_text: "<script>alert('xss')</script>",
    };
    const evilHtml = renderArtifactHtml({ payload, ai: evilAi });
    expect(evilHtml).not.toContain("<script>alert");
    expect(evilHtml).toContain("&lt;script&gt;");
  });

  it("renders data_warnings section when payload has warnings", () => {
    const warned: PrecomputedPayload = {
      ...payload,
      data_warnings: ["브랜드검색 영역별 성과: Naver API 미제공"],
    };
    const warnedHtml = renderArtifactHtml({ payload: warned, ai });
    expect(warnedHtml).toContain("Naver API 미제공");
  });
});
