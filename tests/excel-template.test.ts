import { describe, it, expect } from "vitest";
import path from "node:path";
import { existsSync } from "node:fs";
import {
  parseHelloMaxXlsx,
  parseDailyRawSheet,
  type DailyRawJsonRow,
} from "../src/parser/excel-template.js";
import { aggregateWeeklyPayload } from "../src/parser/aggregate-payload.js";

const root = path.resolve(__dirname, "..");
const FORM_FIXTURE = path.join(
  root,
  "tests/fixtures/anonymized/client-a-form.xlsx",
);
const JSON_FIXTURE_A = path.join(
  root,
  "tests/fixtures/anonymized/client-a-weekly-raw.json",
);

describe("US-015 parseHelloMaxXlsx — anonymized form file", () => {
  it("fixture file exists (sanity)", () => {
    expect(existsSync(FORM_FIXTURE)).toBe(true);
  });

  it("reads the 일별RAW sheet and returns 17-column rows", async () => {
    const rows = await parseHelloMaxXlsx(FORM_FIXTURE);
    expect(rows.length).toBeGreaterThan(0);
    const first = rows[0];
    expect(first).toHaveProperty("매체");
    expect(first).toHaveProperty("캠페인유형");
    expect(first).toHaveProperty("디바이스");
    expect(first).toHaveProperty("광고비 (VAT-)");
    expect(first).toHaveProperty("노출수");
    expect(first).toHaveProperty("클릭수");
    expect(first).toHaveProperty("전환매출액");
  });

  it("strips trailing dot from header keys (월별. → 월별)", async () => {
    const rows = await parseHelloMaxXlsx(FORM_FIXTURE);
    const first = rows[0];
    expect(Object.keys(first)).toContain("월별");
    expect(Object.keys(first)).not.toContain("월별.");
  });

  it("normalizes Date cells to ISO yyyy-mm-dd strings", async () => {
    const rows = await parseHelloMaxXlsx(FORM_FIXTURE);
    for (const r of rows) {
      expect(typeof r["날짜"]).toBe("string");
      expect(r["날짜"]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("coerces numeric strings to numbers (광고비, 노출수, 클릭수)", async () => {
    const rows = await parseHelloMaxXlsx(FORM_FIXTURE);
    for (const r of rows) {
      expect(typeof r["광고비 (VAT-)"]).toBe("number");
      expect(typeof r["노출수"]).toBe("number");
      expect(typeof r["클릭수"]).toBe("number");
    }
  });

  it("treats missing/blank cells as 0 (not undefined or NaN)", async () => {
    const rows = await parseHelloMaxXlsx(FORM_FIXTURE);
    for (const r of rows) {
      expect(Number.isFinite(r["전환매출액"])).toBe(true);
      expect(Number.isFinite(r["회원가입"])).toBe(true);
    }
  });
});

describe("US-015 parseDailyRawSheet — pure header-detection logic", () => {
  it("recognizes header row regardless of cell value being trimmed/dot-suffixed", () => {
    const sheetData = [
      [
        "월별.",
        "주차.",
        "날짜.",
        "매체.",
        "캠페인유형.",
        "캠페인.",
        "광고그룹.",
        "디바이스.",
        "광고비 (VAT-).",
        "노출수.",
        "클릭수.",
        "구매완료.",
        "회원가입.",
        "신청완료.",
        "기타전환.",
        "전환매출액.",
        "평균노출순위.",
      ],
      [
        "2026-04",
        "2026-04-27주차",
        "2026-04-27",
        "네이버",
        "파워링크",
        "ClientA#파워링크#PC",
        "파워링크#adgrp#0",
        "PC",
        22745,
        5793,
        4,
        0,
        0,
        0,
        1,
        0,
        4.6,
      ],
    ];
    const out = parseDailyRawSheet(sheetData);
    expect(out).toHaveLength(1);
    expect(out[0]["광고비 (VAT-)"]).toBe(22745);
    expect(out[0]["디바이스"]).toBe("PC");
  });

  it("treats #DIV/0! sentinel as 0", () => {
    const sheetData = [
      [
        "월별.",
        "주차.",
        "날짜.",
        "매체.",
        "캠페인유형.",
        "캠페인.",
        "광고그룹.",
        "디바이스.",
        "광고비 (VAT-).",
        "노출수.",
        "클릭수.",
        "구매완료.",
        "회원가입.",
        "신청완료.",
        "기타전환.",
        "전환매출액.",
        "평균노출순위.",
      ],
      [
        "2026-04",
        "2026-04-27주차",
        "2026-04-27",
        "네이버",
        "파워링크",
        "x",
        "y",
        "PC",
        "#DIV/0!",
        5793,
        4,
        0,
        0,
        0,
        0,
        0,
        4.6,
      ],
    ];
    const out = parseDailyRawSheet(sheetData);
    expect(out[0]["광고비 (VAT-)"]).toBe(0);
  });

  it("rejects empty sheet (no headers)", () => {
    expect(() => parseDailyRawSheet([])).toThrow();
  });

  it("rejects header row missing required column", () => {
    const broken = [
      ["월별.", "주차.", "날짜."],
      ["2026-04", "2026-04-27주차", "2026-04-27"],
    ];
    expect(() => parseDailyRawSheet(broken)).toThrow();
  });
});

describe("US-015 aggregateWeeklyPayload — DailyRawRow[] + targetWeek → PrecomputedPayload", () => {
  it("produces a valid payload from JSON fixture (client-a, week 2026-W18)", async () => {
    const fs = await import("node:fs");
    const data = JSON.parse(fs.readFileSync(JSON_FIXTURE_A, "utf8")) as {
      rows: DailyRawJsonRow[];
    };
    const payload = aggregateWeeklyPayload({
      advertiser: "ClientA",
      rows: data.rows,
      targetWeek: "2026-05-04주차",
      compareWeek: "2026-04-27주차",
    });
    expect(payload.advertiser).toBe("ClientA");
    expect(payload.report_period.start).toBeDefined();
    expect(payload.report_period.end).toBeDefined();
    expect(payload.kpi_current.impressions).toBeGreaterThanOrEqual(0);
    expect(payload.kpi_previous.impressions).toBeGreaterThanOrEqual(0);
    expect(payload.media.length).toBeGreaterThanOrEqual(1);
    // No NaN / Infinity in deltas
    for (const v of Object.values(payload.kpi_wow)) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it("aggregates multiple media (파워링크 + 쇼핑검색 if present)", async () => {
    const fs = await import("node:fs");
    const data = JSON.parse(fs.readFileSync(JSON_FIXTURE_A, "utf8")) as {
      rows: DailyRawJsonRow[];
    };
    const payload = aggregateWeeklyPayload({
      advertiser: "ClientA",
      rows: data.rows,
      targetWeek: "2026-05-04주차",
      compareWeek: "2026-04-27주차",
    });
    const labels = payload.media.map((m) => m.label);
    expect(labels.length).toBeGreaterThanOrEqual(1);
    // All labels in known set
    for (const l of labels) {
      expect(["파워링크", "쇼핑검색", "브랜드검색", "파워컨텐츠"]).toContain(l);
    }
  });

  it("device breakdown sums to TOTAL row per media block", async () => {
    const fs = await import("node:fs");
    const data = JSON.parse(fs.readFileSync(JSON_FIXTURE_A, "utf8")) as {
      rows: DailyRawJsonRow[];
    };
    const payload = aggregateWeeklyPayload({
      advertiser: "ClientA",
      rows: data.rows,
      targetWeek: "2026-05-04주차",
      compareWeek: "2026-04-27주차",
    });
    for (const block of payload.media) {
      const total = block.rows.find((r) => r.device === "TOTAL");
      const pc = block.rows.find((r) => r.device === "PC");
      const mo = block.rows.find((r) => r.device === "MO");
      if (total && (pc || mo)) {
        const sumImpressions = (pc?.impressions ?? 0) + (mo?.impressions ?? 0);
        expect(total.impressions).toBe(sumImpressions);
      }
    }
  });

  it("returns empty media[] (not crash) when neither week has any rows", () => {
    const payload = aggregateWeeklyPayload({
      advertiser: "Empty",
      rows: [],
      targetWeek: "2026-05-04주차",
      compareWeek: "2026-04-27주차",
    });
    expect(payload.media).toEqual([]);
    expect(payload.kpi_current.impressions).toBe(0);
  });

  it("data_warnings populated when current week has zero rows", () => {
    const payload = aggregateWeeklyPayload({
      advertiser: "Sparse",
      rows: [],
      targetWeek: "2026-05-04주차",
      compareWeek: "2026-04-27주차",
    });
    expect(payload.data_warnings.length).toBeGreaterThan(0);
  });
});

describe("US-015 6 anonymized fixtures parse + aggregate (AC: 6 광고주 fixture)", () => {
  const FIXTURE_NAMES = [
    "client-a",
    "client-b",
    "client-c",
    "client-d",
    "client-e",
    "client-f",
  ];

  for (const name of FIXTURE_NAMES) {
    it(`${name}: parse + aggregate + validate PrecomputedPayload schema`, async () => {
      const fs = await import("node:fs");
      const file = path.join(
        root,
        `tests/fixtures/anonymized/${name}-weekly-raw.json`,
      );
      expect(existsSync(file)).toBe(true);
      const data = JSON.parse(fs.readFileSync(file, "utf8")) as {
        rows: DailyRawJsonRow[];
      };
      const payload = aggregateWeeklyPayload({
        advertiser: name,
        rows: data.rows,
        targetWeek: "2026-05-04주차",
        compareWeek: "2026-04-27주차",
      });
      const { PrecomputedPayloadSchema } =
        await import("../src/parser/types.js");
      const result = PrecomputedPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  }

  it("aggregate output is deterministic for identical input", async () => {
    const fs = await import("node:fs");
    const file = path.join(
      root,
      "tests/fixtures/anonymized/client-a-weekly-raw.json",
    );
    const data = JSON.parse(fs.readFileSync(file, "utf8")) as {
      rows: DailyRawJsonRow[];
    };
    const a = aggregateWeeklyPayload({
      advertiser: "x",
      rows: data.rows,
      targetWeek: "2026-05-04주차",
      compareWeek: "2026-04-27주차",
    });
    const b = aggregateWeeklyPayload({
      advertiser: "x",
      rows: data.rows,
      targetWeek: "2026-05-04주차",
      compareWeek: "2026-04-27주차",
    });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
