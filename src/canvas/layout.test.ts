import { describe, expect, it } from "vitest";
import { assignParents, descendants, renderScale, unionBox } from "./layout";

const box = (left: number, top: number, width: number, height: number) => ({ left, top, width, height });

describe("assignParents", () => {
  it("puts each element in the smallest frame containing its center", () => {
    const parents = assignParents([
      { id: "page", kind: "frame", bounds: box(0, 0, 1000, 1000) },
      { id: "card", kind: "frame", bounds: box(100, 100, 400, 300) },
      { id: "button", kind: "vector_drawing", bounds: box(150, 150, 100, 40) },
      { id: "footer", kind: "vector_drawing", bounds: box(100, 900, 800, 50) },
      { id: "outside", kind: "capture", bounds: box(2000, 0, 100, 100) },
    ]);
    expect(parents).toEqual({ page: undefined, card: "page", button: "card", footer: "page", outside: undefined });
  });

  it("never makes a frame the child of a frame that is not larger", () => {
    const parents = assignParents([
      { id: "a", kind: "frame", bounds: box(0, 0, 300, 300) },
      { id: "b", kind: "frame", bounds: box(0, 0, 300, 300) },
    ]);
    expect(parents).toEqual({ a: undefined, b: undefined });
  });
});

describe("unionBox", () => {
  it("bounds all boxes with a margin", () => {
    expect(unionBox([box(0, 0, 10, 10), box(90, 40, 10, 20)], 5)).toEqual(box(-5, -5, 110, 70));
  });

  it("is null for nothing", () => {
    expect(unionBox([], 5)).toBeNull();
  });
});

describe("renderScale", () => {
  it("keeps small renders at scale 1 and shrinks large ones to the max side", () => {
    expect(renderScale(box(0, 0, 800, 600), 2000)).toBe(1);
    expect(renderScale(box(0, 0, 4000, 1000), 2000)).toBe(0.5);
    expect(renderScale(box(0, 0, 1000, 8000), 2000)).toBe(0.25);
  });
});

describe("descendants", () => {
  it("collects children and grandchildren of a frame", () => {
    const parents = { page: undefined, card: "page", button: "card", footer: "page", other: undefined };
    expect(descendants(parents, "page").sort()).toEqual(["button", "card", "footer"]);
    expect(descendants(parents, "button")).toEqual([]);
  });
});
