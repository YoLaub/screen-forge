import { describe, expect, it } from "vitest";
import { dragBox, polygonPoints, snapLine, toolForKey } from "./tools";

const key = (k: string, mods: Partial<KeyboardEvent> = {}) =>
  ({ key: k, metaKey: false, ctrlKey: false, altKey: false, ...mods }) as KeyboardEvent;

describe("toolForKey", () => {
  it("maps single letters to tools, in either case", () => {
    expect(toolForKey(key("r"))).toBe("rect");
    expect(toolForKey(key("O"))).toBe("ellipse");
    expect(toolForKey(key("v"))).toBe("select");
    expect(toolForKey(key("f"))).toBe("frame");
  });

  it("ignores shortcuts that use a modifier (Cmd+V is paste)", () => {
    expect(toolForKey(key("v", { metaKey: true }))).toBeUndefined();
    expect(toolForKey(key("t", { ctrlKey: true }))).toBeUndefined();
    expect(toolForKey(key("x"))).toBeUndefined();
  });
});

describe("dragBox", () => {
  it("normalizes a drag in any direction", () => {
    expect(dragBox({ x: 100, y: 80 }, { x: 40, y: 20 }, false)).toEqual({ left: 40, top: 20, width: 60, height: 60 });
    expect(dragBox({ x: 0, y: 0 }, { x: 30, y: 10 }, false)).toEqual({ left: 0, top: 0, width: 30, height: 10 });
  });

  it("keeps a square with Shift, growing towards the drag", () => {
    expect(dragBox({ x: 100, y: 100 }, { x: 70, y: 180 }, true)).toEqual({ left: 20, top: 100, width: 80, height: 80 });
  });
});

describe("snapLine", () => {
  it("leaves the end free without Shift", () => {
    expect(snapLine({ x: 0, y: 0 }, { x: 100, y: 7 }, false)).toEqual({ x: 100, y: 7 });
  });

  it("snaps to the nearest 45° with Shift, keeping the length", () => {
    const end = snapLine({ x: 0, y: 0 }, { x: 100, y: 7 }, true);
    expect(end.x).toBeCloseTo(Math.hypot(100, 7));
    expect(end.y).toBeCloseTo(0);
    const diagonal = snapLine({ x: 0, y: 0 }, { x: 50, y: 45 }, true);
    expect(diagonal.x).toBeCloseTo(diagonal.y);
  });
});

describe("polygonPoints", () => {
  it("inscribes a regular polygon in the box, first vertex at the top", () => {
    const pts = polygonPoints(4, { left: 0, top: 0, width: 100, height: 100 });
    expect(pts).toHaveLength(4);
    expect(pts[0].x).toBeCloseTo(50);
    expect(pts[0].y).toBeCloseTo(0);
    expect(pts[2].y).toBeCloseTo(100);
  });
});
