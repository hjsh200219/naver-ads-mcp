const DEFAULT_TIMEZONE = "Asia/Seoul";

export function ensureDefaultTimezone(): void {
  if (process.env.TZ === undefined || process.env.TZ.trim() === "") {
    process.env.TZ = DEFAULT_TIMEZONE;
  }
}
