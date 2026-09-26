import { describe, expect, it } from "vitest";
import { cropBox, polygonArea, rectPolygon, splitByLine, toImagePoints } from "./cut";

describe("toImagePoints", () => {
  it("maps scene points to image pixels through the inverse transform, from the image center", () => {
    // Image 200x100 centered at (500, 300), scaled by 0.5: its inverse maps scene to local.
    const inverse = [2, 0, 0, 2, -1000, -600] as const;
    const pts = toImagePoints([{ x: 450, y: 275 }, { x: 550, y: 325 }], inverse, 200, 100);
    expect(pts).toEqual([
      { x: 0, y: 0 },
      { x: 200, y: 100 },
    ]);
  });
});

describe("rectPolygon", () => {
  it("gives the four corners of a drag in any direction", () => {
    expect(rectPolygon({ x: 10, y: 20 }, { x: 0, y: 0 })).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 20 },
      { x: 0, y: 20 },
    ]);
  });
});

describe("splitByLine", () => {
  it("cuts the image rectangle in two along the line through both points", () => {
    const halves = splitByLine(100, 50, { x: 40, y: -10 }, { x: 40, y: 60 });
    expect(halves).not.toBeNull();
    const areas = halves!.map(polygonArea).sort((a, b) => a - b);
    expect(areas).toEqual([2000, 3000]);
  });

  it("returns null when the line misses the image", () => {
    expect(splitByLine(100, 50, { x: 150, y: 0 }, { x: 150, y: 50 })).toBeNull();
  });
});

describe("cropBox", () => {
  it("is the pixel box of the polygon, clamped to the image", () => {
    expect(cropBox([{ x: -5, y: 10.4 }, { x: 30.2, y: 12 }, { x: 20, y: 80 }], 100, 50)).toEqual({ left: 0, top: 10, width: 31, height: 40 });
  });

  it("is null when the polygon is outside the image or too small", () => {
    expect(cropBox([{ x: 200, y: 0 }, { x: 210, y: 0 }, { x: 205, y: 10 }], 100, 50)).toBeNull();
    expect(cropBox([{ x: 1, y: 1 }, { x: 1.5, y: 1 }, { x: 1, y: 1.5 }], 100, 50)).toBeNull();
  });
});
