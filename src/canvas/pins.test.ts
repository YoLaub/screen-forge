import { describe, expect, it } from "vitest";
import type { LayerItem } from "./layers";
import { pinNumbers, pinPlacement } from "./pins";

const item = (id: string, extra: Partial<LayerItem> = {}): LayerItem => ({
  id,
  name: id,
  kind: "vector_drawing",
  hidden: false,
  locked: false,
  ...extra,
});

describe("pinNumbers", () => {
  it("numbers elements with instructions in layers order, top to bottom", () => {
    const rows = [item("frame", { kind: "frame", instructed: true }), item("a"), item("b", { instructed: true }), item("c", { instructed: true })];
    expect(pinNumbers(rows)).toEqual(new Map([["frame", 1], ["b", 2], ["c", 3]]));
  });

  it("skips hidden elements (the agent does not get them) and group rows", () => {
    const rows = [item("g", { kind: "group", instructed: true }), item("a", { instructed: true, hidden: true }), item("b", { instructed: true })];
    expect(pinNumbers(rows)).toEqual(new Map([["b", 1]]));
  });
});

describe("pinPlacement", () => {
  it("puts the pin on the top-right corner and the callout to the right, in screen pixels", () => {
    expect(pinPlacement({ left: 100, top: 50, width: 200, height: 40 })).toEqual({
      pin: { x: 290, y: 40 },
      callout: { x: 316, y: 38 },
    });
  });
});
