import { describe, expect, it } from "vitest";
import { bezierPoint, gridBackground, linkCurve, selectionOverlay } from "./canvasVisuals";

describe("gridBackground", () => {
  it("scales the 20 px dot grid with the zoom and follows the pan", () => {
    expect(gridBackground([1, 0, 0, 1, 0, 0])).toEqual({ size: 20, x: 0, y: 0 });
    expect(gridBackground([2, 0, 0, 2, 35, -12])).toEqual({ size: 40, x: 35, y: -12 });
  });

  it("keeps the dots readable when zoomed far out", () => {
    expect(gridBackground([0.1, 0, 0, 0.1, 0, 0]).size).toBe(8);
  });
});

describe("linkCurve", () => {
  const a = { left: 0, top: 0, width: 100, height: 40 };

  it("leaves the side facing the target and arrives on the opposite side, with horizontal tangents", () => {
    const c = linkCurve(a, { left: 300, top: 100, width: 80, height: 60 })!;
    expect(c.from).toEqual({ x: 100, y: 20 });
    expect(c.to).toEqual({ x: 300, y: 130 });
    expect(c.c1).toEqual({ x: 200, y: 20 });
    expect(c.c2).toEqual({ x: 200, y: 130 });
  });

  it("goes vertically when the target is mostly below", () => {
    const c = linkCurve(a, { left: 20, top: 300, width: 60, height: 40 })!;
    expect(c.from).toEqual({ x: 50, y: 40 });
    expect(c.to).toEqual({ x: 50, y: 300 });
  });

  it("draws nothing for overlapping boxes", () => {
    expect(linkCurve(a, { left: 50, top: 10, width: 100, height: 40 })).toBeNull();
  });
});

describe("bezierPoint", () => {
  it("is the curve's midpoint at t = 0.5", () => {
    expect(bezierPoint({ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 0 }, 0.5)).toEqual({ x: 5, y: 7.5 });
  });
});

describe("selectionOverlay", () => {
  it("puts the size chip under the selection and the boolean bar 34 px below it", () => {
    expect(selectionOverlay({ left: 100, top: 50, width: 200, height: 40 }, { width: 236.4, height: 44 })).toEqual({
      chip: { x: 200, y: 97, label: "236 × 44" },
      bar: { x: 100, y: 124 },
    });
  });
});
