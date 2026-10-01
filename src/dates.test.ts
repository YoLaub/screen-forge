import { describe, expect, it } from "vitest";
import { dayLabel } from "./dates";

const at = (y: number, mo: number, d: number, h = 12) => new Date(y, mo - 1, d, h).getTime();
const NOW = at(2026, 10, 1, 14);

describe("dayLabel", () => {
  it("says Today and Yesterday, whatever the hour", () => {
    expect(dayLabel(at(2026, 10, 1, 0), NOW)).toBe("Today");
    expect(dayLabel(at(2026, 10, 1, 23), NOW + 60_000)).toBe("Today");
    expect(dayLabel(at(2026, 9, 30, 23), NOW)).toBe("Yesterday");
  });

  it("gives the date for older days, with the year when it is not this one", () => {
    expect(dayLabel(at(2026, 9, 12), NOW)).toBe("12 Sep");
    expect(dayLabel(at(2025, 12, 31), NOW)).toBe("31 Dec 2025");
  });

  it("treats a future date (clock skew) as today", () => {
    expect(dayLabel(NOW + 3 * 86_400_000, NOW)).toBe("Today");
  });
});
