import { describe, expect, it } from "vitest";
import { groupWindows, moveActive, sizeLabel } from "./pickerModel";
import type { WindowInfo } from "./WindowPicker";

const win = (id: number, app: string, title: string): WindowInfo => ({ id, app_name: app, title, width: 1280, height: 864 });
const windows = [win(1, "Safari", "Acme · Sign in"), win(2, "Google Chrome", "Acme · Dashboard"), win(3, "Safari", "Acme · Pricing")];

describe("groupWindows", () => {
  it("groups by app in order of first appearance, each window keeping its index in display order", () => {
    const { groups, flat } = groupWindows(windows, "");
    expect(groups.map((g) => g.app)).toEqual(["Safari", "Google Chrome"]);
    expect(groups[0].items.map((i) => [i.window.id, i.index])).toEqual([[1, 0], [3, 1]]);
    expect(groups[1].items.map((i) => [i.window.id, i.index])).toEqual([[2, 2]]);
    expect(flat.map((w) => w.id)).toEqual([1, 3, 2]);
  });

  it("filters on app and title, ignoring case, and drops empty groups", () => {
    expect(groupWindows(windows, "DASH").flat.map((w) => w.id)).toEqual([2]);
    expect(groupWindows(windows, "safari").flat.map((w) => w.id)).toEqual([1, 3]);
    expect(groupWindows(windows, "  pricing ").groups.map((g) => g.app)).toEqual(["Safari"]);
    expect(groupWindows(windows, "zzz").groups).toEqual([]);
  });
});

describe("moveActive", () => {
  it("moves by one and stops at both ends", () => {
    expect(moveActive(0, 3, 1)).toBe(1);
    expect(moveActive(2, 3, 1)).toBe(2);
    expect(moveActive(0, 3, -1)).toBe(0);
  });

  it("stays at 0 when there is nothing to move through", () => {
    expect(moveActive(0, 0, 1)).toBe(0);
  });
});

describe("sizeLabel", () => {
  it("writes the size as in the mockup", () => {
    expect(sizeLabel({ width: 1280, height: 864 })).toBe("1280 × 864");
  });
});
