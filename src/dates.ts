export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const two = (n: number) => String(n).padStart(2, "0");

/** "09:05", 24 hours, local time. */
export function clock(d: Date): string {
  return `${two(d.getHours())}:${two(d.getMinutes())}`;
}

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Whole calendar days from `at` to `now` (0 = the same day, 1 = yesterday; negative in the future). */
export function daysAgo(at: Date, now: Date): number {
  return Math.round((dayStart(now) - dayStart(at)) / 86_400_000);
}

/** "28 Sep". */
export function dayMonth(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "Today", "Yesterday", "12 Sep", or "31 Dec 2025" when it is not this year. */
export function dayLabel(atMs: number, nowMs: number): string {
  const at = new Date(atMs);
  const now = new Date(nowMs);
  const days = daysAgo(at, now);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return at.getFullYear() === now.getFullYear() ? dayMonth(at) : `${dayMonth(at)} ${at.getFullYear()}`;
}

/** "Today, 14:01", "Yesterday, 09:30" or "12 Sep, 16:30": the day then the time. */
export function dayTimeLabel(atMs: number, nowMs: number): string {
  return `${dayLabel(atMs, nowMs)}, ${clock(new Date(atMs))}`;
}
