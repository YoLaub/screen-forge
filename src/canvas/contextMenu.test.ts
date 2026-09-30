import { describe, expect, it } from "vitest";
import { menuItems, pasteDelta } from "./contextMenu";

const enabled = (items: ReturnType<typeof menuItems>) =>
  Object.fromEntries(items.filter((i) => i !== "separator").map((i) => [i.id, i.enabled]));

describe("menuItems", () => {
  it("offers only Paste on empty canvas, when something was copied", () => {
    const e = enabled(menuItems({ count: 0, allLocked: false, grouped: false }, true));
    expect(e).toMatchObject({ copy: false, paste: true, duplicate: false, lock: false, forward: false, backward: false });
    expect(enabled(menuItems({ count: 0, allLocked: false, grouped: false }, false)).paste).toBe(false);
  });

  it("acts on the targets, and restacks one element at a time", () => {
    expect(enabled(menuItems({ count: 1, allLocked: false, grouped: false }, false))).toMatchObject({ copy: true, duplicate: true, lock: true, forward: true, backward: true });
    expect(enabled(menuItems({ count: 3, allLocked: false, grouped: false }, false))).toMatchObject({ forward: false, backward: false });
  });

  it("offers Unlock when every target is locked", () => {
    const lock = menuItems({ count: 2, allLocked: true, grouped: false }, false).find((i) => i !== "separator" && i.id === "lock");
    expect(lock).toMatchObject({ label: "Unlock", enabled: true });
    const lockAgain = menuItems({ count: 2, allLocked: false, grouped: false }, false).find((i) => i !== "separator" && i.id === "lock");
    expect(lockAgain).toMatchObject({ label: "Lock" });
  });
});

describe("menuItems groups", () => {
  it("groups two elements or more, and ungroups when a target is in a group", () => {
    expect(enabled(menuItems({ count: 1, allLocked: false, grouped: false }, false))).toMatchObject({ group: false, ungroup: false });
    expect(enabled(menuItems({ count: 2, allLocked: false, grouped: false }, false))).toMatchObject({ group: true, ungroup: false });
    expect(enabled(menuItems({ count: 1, allLocked: false, grouped: true }, false))).toMatchObject({ ungroup: true });
  });
});

describe("pasteDelta", () => {
  const copied = { left: 100, top: 100, width: 50, height: 30 };

  it("shifts each successive paste 20 px further", () => {
    expect(pasteDelta(copied, 1)).toEqual({ x: 20, y: 20 });
    expect(pasteDelta(copied, 3)).toEqual({ x: 60, y: 60 });
  });

  it("centers the paste on a point when one is given", () => {
    expect(pasteDelta(copied, 1, { x: 500, y: 400 })).toEqual({ x: 375, y: 285 });
  });
});
