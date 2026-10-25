export type DashboardPeriodPreset = "today" | "7d" | "30d" | "custom";

export interface DashboardDateRange {
  from: string;
  to: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Calendar date in Europe/Kyiv, matching GET /dashboard/stats. */
export function kyivToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addCalendarDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) return isoDate;
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  const nextYear = date.getUTCFullYear();
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getUTCDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

export function presetRange(
  preset: Exclude<DashboardPeriodPreset, "custom">,
  today = kyivToday(),
): DashboardDateRange {
  if (preset === "today") return { from: today, to: today };
  const length = preset === "7d" ? 7 : 30;
  return { from: addCalendarDays(today, 1 - length), to: today };
}

export function customRangeIssue(range: DashboardDateRange): "incomplete" | "inverted" | null {
  if (!ISO_DATE.test(range.from) || !ISO_DATE.test(range.to)) return "incomplete";
  if (range.from > range.to) return "inverted";
  return null;
}

/** Inclusive dates sent as `from` and `to`. `null` means the custom range is not ready. */
export function resolveDashboardRange(
  preset: DashboardPeriodPreset,
  custom: DashboardDateRange,
  today = kyivToday(),
): DashboardDateRange | null {
  if (preset !== "custom") return presetRange(preset, today);
  if (customRangeIssue(custom) !== null) return null;
  return { from: custom.from, to: custom.to };
}

export function formatIsoDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}.${month}.${year}`;
}

/** Format a `YYYY-MM-DD` calendar date without shifting it across time zones. */
export function formatChartDay(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return new Date(year, month - 1, day).toLocaleDateString("uk-UA", {
    day: "2-digit",
    month: "short",
    weekday: "short",
  });
}
