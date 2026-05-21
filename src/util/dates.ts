function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function toDate(input: string | Date): Date {
  if (input instanceof Date) return new Date(input.getTime());
  // "20260206" or "2026-02-06" or "2026-02-06T..."
  if (/^\d{8}$/.test(input)) {
    return new Date(
      `${input.slice(0, 4)}-${input.slice(4, 6)}-${input.slice(6, 8)}T00:00:00`,
    );
  }
  return new Date(input);
}

/** "20260206" / "2026-02-06" / Date → "2026-02-06" */
export function normalizeDate(input: string | Date): string {
  const d = toDate(input);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Date → "2026-02" */
export function deriveMonth(input: string | Date): string {
  const d = toDate(input);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/** Date → "YYYY-MM-DD주차" where the date portion is the Monday of that week */
export function deriveWeek(input: string | Date): string {
  const d = toDate(input);
  // getDay(): 0=Sun, 1=Mon, ..., 6=Sat
  const dow = d.getDay();
  const offsetToMonday = dow === 0 ? -6 : 1 - dow; // Sun→-6, Mon→0, Tue→-1, ..., Sat→-5
  const monday = new Date(d.getTime());
  monday.setDate(d.getDate() + offsetToMonday);
  return `${monday.getFullYear()}-${pad2(monday.getMonth() + 1)}-${pad2(monday.getDate())}주차`;
}

/**
 * ISO week "YYYY-Www" → Monday Date of that week.
 * Implements the ISO 8601 algorithm: week 1 contains the year's first Thursday.
 */
export function isoWeekToMonday(isoWeek: string): Date {
  const match = /^(\d{4})-W(\d{2})$/.exec(isoWeek);
  if (!match) throw new Error(`Invalid ISO week: ${isoWeek}`);
  const year = Number(match[1]);
  const week = Number(match[2]);
  // Jan 4 is always in ISO week 1.
  const jan4 = new Date(year, 0, 4);
  const jan4Dow = jan4.getDay() === 0 ? 7 : jan4.getDay(); // 1..7 (Mon..Sun)
  const week1Monday = new Date(jan4.getTime());
  week1Monday.setDate(jan4.getDate() - (jan4Dow - 1));
  const target = new Date(week1Monday.getTime());
  target.setDate(week1Monday.getDate() + (week - 1) * 7);
  return target;
}

/** Date → "YYYYMMDD" compact form for stat-report APIs. */
export function toYmdCompact(input: string | Date): string {
  const d = toDate(input);
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
}

/** Add N days (can be negative) to a date and return the new Date. */
export function addDays(input: string | Date, days: number): Date {
  const d = toDate(input);
  d.setDate(d.getDate() + days);
  return d;
}
