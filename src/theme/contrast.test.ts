import { describe, expect, it } from "vitest";
import { DRAWING, SHAPE_STYLE } from "../canvas/drawingDefaults";
import { contrastRatio } from "./contrast";
import { THEMES } from "./tokens";

describe("contrastRatio", () => {
  it("follows WCAG: black on white is 21, a color on itself is 1", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#0a7f97", "#0a7f97")).toBeCloseTo(1, 5);
  });
});

describe("annotation defaults", () => {
  // Drawing colors are content (not themed): they must read on both canvases.
  const strokes = { pen: DRAWING.pen, line: DRAWING.line, text: DRAWING.text, cross: DRAWING.cross };

  for (const [name, color] of Object.entries(strokes)) {
    it(`${name} reads on the light and dark canvas (3:1 for graphics)`, () => {
      expect(contrastRatio(color, THEMES.light.canvas)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(color, THEMES.dark.canvas)).toBeGreaterThanOrEqual(3);
    });
  }
});

describe("new shapes", () => {
  it("are outlines in the annotation color, so they never hide the capture under them", () => {
    expect(SHAPE_STYLE.fill).toBe("");
    expect(SHAPE_STYLE.stroke).toBe(DRAWING.cross);
    expect(SHAPE_STYLE.strokeWidth).toBe(2);
  });
});
