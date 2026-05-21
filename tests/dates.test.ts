import { describe, it, expect } from "vitest";
import {
  normalizeDate,
  deriveMonth,
  deriveWeek,
  isoWeekToMonday,
  toYmdCompact,
  addDays,
} from "../src/util/dates.js";

describe("normalizeDate", () => {
  it("converts compact 8-digit string to ISO date", () => {
    expect(normalizeDate("20260206")).toBe("2026-02-06");
  });

  it("passes through ISO date string unchanged", () => {
    expect(normalizeDate("2026-02-06")).toBe("2026-02-06");
  });

  it("converts Date object to ISO date string", () => {
    expect(normalizeDate(new Date(2026, 1, 6))).toBe("2026-02-06");
  });

  it("handles end of year", () => {
    expect(normalizeDate("20261231")).toBe("2026-12-31");
  });
});

describe("deriveMonth", () => {
  it("extracts YYYY-MM from ISO date", () => {
    expect(deriveMonth("2026-02-06")).toBe("2026-02");
  });

  it("extracts YYYY-MM from compact 8-digit string", () => {
    expect(deriveMonth("20261231")).toBe("2026-12");
  });
});

describe("deriveWeek", () => {
  it("Friday → previous Monday (Feb 6 is Friday, Monday is Feb 2)", () => {
    expect(deriveWeek("2026-02-06")).toBe("2026-02-02주차");
  });

  it("Monday → same day", () => {
    expect(deriveWeek("2026-02-02")).toBe("2026-02-02주차");
  });

  it("Sunday → previous Monday (Feb 8 is Sunday, Monday is Feb 2)", () => {
    expect(deriveWeek("2026-02-08")).toBe("2026-02-02주차");
  });

  it("next Monday → that Monday", () => {
    expect(deriveWeek("2026-02-09")).toBe("2026-02-09주차");
  });

  it("Tuesday → previous Monday", () => {
    // Feb 10 is Tuesday, Monday is Feb 9
    expect(deriveWeek("2026-02-10")).toBe("2026-02-09주차");
  });
});

describe("isoWeekToMonday", () => {
  it("2026-W21 → 2026-05-18 (Monday)", () => {
    const d = isoWeekToMonday("2026-W21");
    expect(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    ).toBe("2026-05-18");
  });

  it("2026-W01 anchors to the first ISO week containing the first Thursday", () => {
    const d = isoWeekToMonday("2026-W01");
    // Jan 1, 2026 is Thursday → ISO week 1 starts on Mon Dec 29, 2025.
    expect(d.getDay()).toBe(1); // Monday
  });

  it("throws on invalid format", () => {
    expect(() => isoWeekToMonday("2026-w21")).toThrow();
    expect(() => isoWeekToMonday("2026-W3")).toThrow();
  });
});

describe("toYmdCompact", () => {
  it("converts ISO date to YYYYMMDD", () => {
    expect(toYmdCompact("2026-05-18")).toBe("20260518");
  });

  it("converts Date to YYYYMMDD", () => {
    expect(toYmdCompact(new Date(2026, 4, 18))).toBe("20260518");
  });
});

describe("addDays", () => {
  it("adds positive days", () => {
    const d = addDays("2026-05-18", 6);
    expect(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    ).toBe("2026-05-24");
  });

  it("adds negative days (subtract)", () => {
    const d = addDays("2026-05-18", -7);
    expect(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    ).toBe("2026-05-11");
  });

  it("crosses month boundary", () => {
    const d = addDays("2026-05-30", 5);
    expect(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    ).toBe("2026-06-04");
  });
});
