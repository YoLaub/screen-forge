import { describe, expect, it, vi } from "vitest";

// Paper.js asks for a 2D context when it loads; jsdom has none, and path
// booleans are pure geometry, so a no-op context is enough.
vi.hoisted(() => {
  const noop: ProxyHandler<object> = { get: (_t, prop) => (prop === "canvas" ? document.createElement("canvas") : () => undefined) };
  HTMLCanvasElement.prototype.getContext = (() => new Proxy({}, noop)) as never;
});

import { booleanShapes } from "./booleans";

const svg = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
const square = (x: number) => svg(`<rect x="${x}" y="0" width="100" height="100"/>`);
const bounds = (anchors: { x: number; y: number }[]) => ({
  left: Math.min(...anchors.map((a) => a.x)),
  right: Math.max(...anchors.map((a) => a.x)),
});

describe("booleanShapes", () => {
  it("unites overlapping shapes into one editable path", () => {
    const result = booleanShapes("union", [square(0), square(50)])!;
    expect(bounds(result.anchors!)).toEqual({ left: 0, right: 150 });
    expect(result.pathData).toMatch(/z$/i);
  });

  it("subtracts the upper shapes from the bottom one", () => {
    const result = booleanShapes("subtract", [square(0), square(50)])!;
    expect(bounds(result.anchors!)).toEqual({ left: 0, right: 50 });
  });

  it("keeps only the overlap when intersecting", () => {
    const result = booleanShapes("intersect", [square(0), square(50)])!;
    expect(bounds(result.anchors!)).toEqual({ left: 50, right: 100 });
  });

  it("gives a multi-part result without editable points when excluding", () => {
    const result = booleanShapes("exclude", [square(0), square(50)])!;
    expect(result.anchors).toBeUndefined();
    expect(result.pathData.match(/z/gi)!.length).toBe(2);
  });

  it("reads transformed and curved shapes", () => {
    const moved = svg(`<g transform="matrix(1 0 0 1 200 0)"><circle cx="0" cy="0" r="50"/></g>`);
    const result = booleanShapes("union", [moved, square(150)])!;
    expect(bounds(result.anchors!).left).toBeCloseTo(150);
    expect(result.anchors!.some((a) => a.in || a.out)).toBe(true);
  });

  it("returns null when nothing is left", () => {
    expect(booleanShapes("intersect", [square(0), square(500)])).toBeNull();
  });
});
