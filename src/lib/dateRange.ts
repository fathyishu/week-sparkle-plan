/**
 * Shared date-range filtering used by every filter control in the app:
 * history views, group task filters, the group leaderboard, and the
 * friends leaderboard. Do not duplicate this logic per screen.
 */

export type RangePreset = "week" | "month" | "lifetime" | "custom";

export interface DateRange {
  /** inclusive lower bound, undefined = unbounded */
  start?: Date;
  /** inclusive upper bound, undefined = unbounded */
  end?: Date;
  preset: RangePreset;
}

export const RANGE_OPTIONS: { value: RangePreset; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "lifetime", label: "Lifetime" },
  { value: "custom", label: "Custom" },
];

const startOfDay = (d: Date) => {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
};
const endOfDay = (d: Date) => {
  const n = new Date(d);
  n.setHours(23, 59, 59, 999);
  return n;
};

/** Monday-based start of the current week. */
export function startOfWeek(ref = new Date()): Date {
  const d = startOfDay(ref);
  const dow = (d.getDay() + 6) % 7; // Mon = 0
  d.setDate(d.getDate() - dow);
  return d;
}

export function buildRange(
  preset: RangePreset,
  customStart?: string,
  customEnd?: string,
  ref = new Date(),
): DateRange {
  if (preset === "lifetime") return { preset };
  if (preset === "week") {
    const s = startOfWeek(ref);
    const e = new Date(s);
    e.setDate(e.getDate() + 6);
    return { preset, start: s, end: endOfDay(e) };
  }
  if (preset === "month") {
    const s = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const e = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    return { preset, start: startOfDay(s), end: endOfDay(e) };
  }
  return {
    preset,
    start: customStart ? startOfDay(new Date(customStart)) : undefined,
    end: customEnd ? endOfDay(new Date(customEnd)) : undefined,
  };
}

/** True when a date (ISO string, yyyy-mm-dd, or Date) falls inside the range. */
export function inRange(date: string | Date | null | undefined, range: DateRange): boolean {
  if (!date) return range.preset === "lifetime" || (!range.start && !range.end);
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return true;
  if (range.start && d < range.start) return false;
  if (range.end && d > range.end) return false;
  return true;
}

/** Generic list filter by a due/occurrence date accessor. */
export function filterByRange<T>(
  items: T[],
  range: DateRange,
  getDate: (item: T) => string | Date | null | undefined,
): T[] {
  return items.filter((i) => inRange(getDate(i), range));
}

/** yyyy-mm-dd for API/SQL params, or null when unbounded. */
export function toDateParam(d?: Date): string | null {
  if (!d) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function rangeLabel(range: DateRange): string {
  if (range.preset === "lifetime") return "All time";
  const f = (d?: Date) => (d ? d.toLocaleDateString() : "—");
  return `${f(range.start)} – ${f(range.end)}`;
}
