import { describe, expect, it } from "vitest";
import { addPoint, dragRect, isUsable, outlinePath } from "./regionShape";

describe("dragRect", () => {
  it("is the box between where the drag started and where it is", () => {
    expect(dragRect({ x: 10, y: 20 }, { x: 40, y: 80 })).toEqual({ kind: "rect", x: 10, y: 20, w: 30, h: 60 });
  });

  it("is the same box when dragged backwards", () => {
    expect(dragRect({ x: 40, y: 80 }, { x: 10, y: 20 })).toEqual({ kind: "rect", x: 10, y: 20, w: 30, h: 60 });
  });
});

describe("addPoint", () => {
  it("keeps a point once the pointer has moved far enough", () => {
    expect(addPoint([{ x: 0, y: 0 }], { x: 5, y: 0 })).toHaveLength(2);
  });

  it("ignores jitter so that the outline stays small", () => {
    expect(addPoint([{ x: 0, y: 0 }], { x: 1, y: 1 })).toHaveLength(1);
  });

  it("starts an outline from nothing", () => {
    expect(addPoint([], { x: 3, y: 3 })).toEqual([{ x: 3, y: 3 }]);
  });
});

describe("isUsable", () => {
  it("wants a rectangle of a few pixels on each side", () => {
    expect(isUsable({ kind: "rect", x: 0, y: 0, w: 30, h: 30 })).toBe(true);
    expect(isUsable({ kind: "rect", x: 0, y: 0, w: 2, h: 30 })).toBe(false);
  });

  it("wants an outline of at least three points", () => {
    expect(isUsable({ kind: "path", points: [{ x: 0, y: 0 }, { x: 9, y: 9 }] })).toBe(false);
    expect(isUsable({ kind: "path", points: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 0, y: 30 }] })).toBe(true);
  });
});

describe("outlinePath", () => {
  it("writes a closed SVG path", () => {
    expect(outlinePath([{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 }])).toBe("M1 2L3 4L5 6Z");
  });

  it("is empty without points", () => {
    expect(outlinePath([])).toBe("");
  });
});
