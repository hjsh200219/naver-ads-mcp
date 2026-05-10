import { describe, expect, it } from "vitest";
import { aggregateDailyPayload } from "../src/parser/aggregate-daily.js";
import type { DailyRawJsonRow } from "../src/parser/excel-template.js";

function row(
  date: string,
  overrides: Partial<DailyRawJsonRow> = {},
): DailyRawJsonRow {
  return {
    월별: "2026-05",
    주차: "2026-05-04주차",
    날짜: date,
    매체: "네이버",
    캠페인유형: "파워링크",
    캠페인: "campaign-1",
    광고그룹: "ag-1",
    디바이스: "PC",
    "광고비 (VAT-)": 10000,
    노출수: 1000,
    클릭수: 50,
    구매완료: 2,
    회원가입: 0,
    신청완료: 0,
    기타전환: 0,
    전환매출액: 50000,
    평균노출순위: 1,
    ...overrides,
  } as DailyRawJsonRow;
}

describe("US-019 aggregateDailyPayload", () => {
  it("computes TOTAL KPI for the target date, DoD, MoM slices", () => {
    const rows: DailyRawJsonRow[] = [
      row("2026-05-08", {
        노출수: 1000,
        클릭수: 50,
        "광고비 (VAT-)": 10000,
        전환매출액: 50000,
      }),
      row("2026-05-07", {
        노출수: 2000,
        클릭수: 100,
        "광고비 (VAT-)": 20000,
        전환매출액: 80000,
      }),
      row("2026-04-08", {
        노출수: 1500,
        클릭수: 80,
        "광고비 (VAT-)": 15000,
        전환매출액: 60000,
      }),
    ];
    const out = aggregateDailyPayload({
      advertiser: "비셰프",
      rows,
      targetDate: "2026-05-08",
      compareDateDoD: "2026-05-07",
      compareDateMoM: "2026-04-08",
    });
    expect(out.advertiser).toBe("비셰프");
    expect(out.target_date).toBe("2026-05-08");
    expect(out.kpi_target.impressions).toBe(1000);
    expect(out.kpi_target.clicks).toBe(50);
    expect(out.kpi_target.cost).toBe(10000);
    expect(out.kpi_target.revenue).toBe(50000);
    expect(out.kpi_dod.impressions).toBe(2000);
    expect(out.kpi_mom.impressions).toBe(1500);
  });

  it("derived metrics map to threshold engine field names", () => {
    const rows: DailyRawJsonRow[] = [
      row("2026-05-08", {
        노출수: 1000,
        클릭수: 50,
        "광고비 (VAT-)": 10000,
        전환매출액: 5000,
      }),
      row("2026-04-08", {
        노출수: 2000,
        클릭수: 50,
        "광고비 (VAT-)": 5000,
        전환매출액: 5000,
      }),
      row("2026-05-07", {
        노출수: 5000,
        클릭수: 100,
        "광고비 (VAT-)": 20000,
        전환매출액: 80000,
      }),
    ];
    const out = aggregateDailyPayload({
      advertiser: "비셰프",
      rows,
      targetDate: "2026-05-08",
      compareDateDoD: "2026-05-07",
      compareDateMoM: "2026-04-08",
    });
    // CPC: target 10000/50=200, MoM 5000/50=100 → +100% MoM
    expect(out.derived.cpc_mom_pct).toBeCloseTo(100, 1);
    // ROAS: target 50%, MoM 100% → -50% MoM
    expect(out.derived.roas_mom_pct).toBeCloseTo(-50, 1);
    // impressions DoD: 1000 vs 5000 → -80%
    expect(out.derived.impressions_dod_pct).toBeCloseTo(-80, 1);
  });

  it("flags D-1 데이터 없음 when target date is empty", () => {
    const rows: DailyRawJsonRow[] = [
      row("2026-05-07", { 노출수: 1000 }),
      row("2026-04-08", { 노출수: 1000 }),
    ];
    const out = aggregateDailyPayload({
      advertiser: "비셰프",
      rows,
      targetDate: "2026-05-08",
      compareDateDoD: "2026-05-07",
      compareDateMoM: "2026-04-08",
    });
    expect(out.data_warnings).toContain("D-1 데이터 없음");
  });

  it("flags MoM 비교 데이터 없음 when MoM date is empty", () => {
    const rows: DailyRawJsonRow[] = [
      row("2026-05-08", { 노출수: 1000 }),
      row("2026-05-07", { 노출수: 1000 }),
    ];
    const out = aggregateDailyPayload({
      advertiser: "비셰프",
      rows,
      targetDate: "2026-05-08",
      compareDateDoD: "2026-05-07",
      compareDateMoM: "2026-04-08",
    });
    expect(out.data_warnings).toContain("MoM 비교 데이터 없음");
  });

  it("zero-baseline derived metrics return null (no division by zero alerts)", () => {
    const rows: DailyRawJsonRow[] = [
      row("2026-05-08", {
        노출수: 1000,
        클릭수: 50,
        "광고비 (VAT-)": 10000,
        전환매출액: 50000,
      }),
      row("2026-05-07", {
        노출수: 0,
        클릭수: 0,
        "광고비 (VAT-)": 0,
        전환매출액: 0,
      }),
      row("2026-04-08", {
        노출수: 1000,
        클릭수: 0,
        "광고비 (VAT-)": 0,
        전환매출액: 0,
      }),
    ];
    const out = aggregateDailyPayload({
      advertiser: "비셰프",
      rows,
      targetDate: "2026-05-08",
      compareDateDoD: "2026-05-07",
      compareDateMoM: "2026-04-08",
    });
    // MoM CPC: prev clicks=0 → CPC undefined → null
    expect(out.derived.cpc_mom_pct).toBeNull();
    // MoM ROAS: prev cost=0 → ROAS undefined → null
    expect(out.derived.roas_mom_pct).toBeNull();
    // DoD impressions: 1000 vs 0 → +Inf → null (zero baseline)
    expect(out.derived.impressions_dod_pct).toBeNull();
  });

  it("sums all conversion-type columns into conversions", () => {
    const rows: DailyRawJsonRow[] = [
      row("2026-05-08", {
        구매완료: 1,
        회원가입: 2,
        신청완료: 3,
        기타전환: 4,
      }),
      row("2026-05-07"),
      row("2026-04-08"),
    ];
    const out = aggregateDailyPayload({
      advertiser: "비셰프",
      rows,
      targetDate: "2026-05-08",
      compareDateDoD: "2026-05-07",
      compareDateMoM: "2026-04-08",
    });
    expect(out.kpi_target.conversions).toBe(10);
  });

  it("filters by date column only (ignores 주차 column)", () => {
    const rows: DailyRawJsonRow[] = [
      row("2026-05-08", { 주차: "2026-05-04주차", 노출수: 1000 }),
      row("2026-05-08", { 주차: "different-week", 노출수: 500 }),
      row("2026-05-07", { 노출수: 100 }),
      row("2026-04-08", { 노출수: 100 }),
    ];
    const out = aggregateDailyPayload({
      advertiser: "비셰프",
      rows,
      targetDate: "2026-05-08",
      compareDateDoD: "2026-05-07",
      compareDateMoM: "2026-04-08",
    });
    expect(out.kpi_target.impressions).toBe(1500);
  });
});
