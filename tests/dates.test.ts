import { describe, it, expect } from "vitest";
import { normalizeDate, deriveMonth, deriveWeek } from "../src/util/dates.js";

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
