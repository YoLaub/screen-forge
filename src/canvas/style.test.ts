import { describe, expect, it } from "vitest";
import { angleOf, colorsOf, linearCoords, normalizeHex, readStyle, toFabricProps } from "./style";

describe("normalizeHex", () => {
  it("accepts the forms a user or Fabric produces", () => {
    expect(normalizeHex("#3b82f6")).toBe("#3B82F6");
    expect(normalizeHex("3B82F6")).toBe("#3B82F6");
    expect(normalizeHex("#abc")).toBe("#AABBCC");
    expect(normalizeHex("rgb(59, 130, 246)")).toBe("#3B82F6");
    expect(normalizeHex("rgba(59,130,246,0.5)")).toBe("#3B82F6");
  });

  it("rejects what is not a color", () => {
    expect(normalizeHex("")).toBeNull();
    expect(normalizeHex("transparent")).toBeNull();
    expect(normalizeHex("#12")).toBeNull();
    expect(normalizeHex("blue-ish")).toBeNull();
  });
});

describe("linear gradient angle", () => {
  it("follows CSS: 90° runs left to right, 180° top to bottom", () => {
    const right = linearCoords(90);
    expect(right.x1).toBeCloseTo(0);
    expect(right.x2).toBeCloseTo(1);
    expect(right.y1).toBeCloseTo(0.5);
    const down = linearCoords(180);
    expect(down.y1).toBeCloseTo(0);
    expect(down.y2).toBeCloseTo(1);
  });

  it("round-trips through coordinates", () => {
    for (const angle of [0, 45, 90, 135, 200, 315]) expect(angleOf(linearCoords(angle))).toBe(angle);
  });
});

describe("readStyle", () => {
  it("keeps only meaningful values", () => {
    expect(
      readStyle({ fill: "#e5e7eb", stroke: "#6b7280", strokeWidth: 1, rx: 0, opacity: 1 }, { radius: true, text: false }),
    ).toEqual({ fill: "#E5E7EB", stroke: "#6B7280", stroke_width: 1 });
  });

  it("drops a zero-width stroke and reports radius and opacity", () => {
    expect(
      readStyle({ fill: "#ffffff", stroke: "#000000", strokeWidth: 0, rx: 8, opacity: 0.456 }, { radius: true, text: false }),
    ).toEqual({ fill: "#FFFFFF", radius: 8, opacity: 0.46 });
  });

  it("reads a gradient fill with its angle and sorted stops", () => {
    const style = readStyle(
      {
        fill: {
          type: "linear",
          coords: linearCoords(90),
          colorStops: [
            { offset: 1, color: "#1d4ed8" },
            { offset: 0, color: "rgb(59,130,246)" },
          ],
        },
      },
      { radius: false, text: false },
    );
    expect(style).toEqual({
      gradient: {
        kind: "linear",
        angle: 90,
        stops: [
          { offset: 0, color: "#3B82F6" },
          { offset: 1, color: "#1D4ED8" },
        ],
      },
    });
  });

  it("adds font size and weight for text", () => {
    expect(readStyle({ fill: "#111827", fontSize: 20, fontWeight: "bold" }, { radius: false, text: true })).toEqual({
      fill: "#111827",
      font_size: 20,
      font_weight: "bold",
    });
  });
});

describe("colorsOf", () => {
  it("lists every color once, fill first", () => {
    expect(
      colorsOf({
        fill: "#FFFFFF",
        stroke: "#1D4ED8",
        gradient: { kind: "linear", stops: [{ offset: 0, color: "#1D4ED8" }, { offset: 1, color: "#93C5FD" }] },
      }),
    ).toEqual(["#FFFFFF", "#1D4ED8", "#93C5FD"]);
  });
});

describe("toFabricProps", () => {
  const applies = { radius: true, text: false };

  it("round-trips a style through Fabric properties", () => {
    const style = { stroke: "#1D4ED8", stroke_width: 2, radius: 8, opacity: 0.5, gradient: {
      kind: "linear" as const, angle: 135, stops: [{ offset: 0, color: "#3B82F6" }, { offset: 1, color: "#1D4ED8" }],
    } };
    expect(readStyle(toFabricProps(style, applies), applies)).toEqual(style);
  });

  it("clears what the style no longer has", () => {
    expect(toFabricProps({}, applies)).toEqual({ fill: "", stroke: "", strokeWidth: 0, rx: 0, ry: 0, opacity: 1 });
  });
});
