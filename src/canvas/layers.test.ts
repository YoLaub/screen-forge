import { describe, expect, it } from "vitest";
import { type LayerItem, layerRows, lockProps } from "./layers";
import { hasInstructions, instructionCoverage, layerIcon } from "./layers";

const item = (id: string, parent?: string, kind: LayerItem["kind"] = "vector_drawing"): LayerItem => ({
  id,
  name: `Name ${id}`,
  kind,
  parent,
  hidden: false,
  locked: false,
});

describe("layerRows", () => {
  it("lists top-level items from the top of the stack, each frame followed by its content", () => {
    // Bottom to top, as the canvas stacks them.
    const rows = layerRows([item("frame", undefined, "frame"), item("a", "frame"), item("b", "frame"), item("stray")]);
    expect(rows.map((r) => [r.item.id, r.depth])).toEqual([
      ["stray", 0],
      ["frame", 0],
      ["b", 1],
      ["a", 1],
    ]);
  });

  it("nests frames inside frames", () => {
    const rows = layerRows([item("page", undefined, "frame"), item("card", "page", "frame"), item("button", "card")]);
    expect(rows.map((r) => [r.item.id, r.depth])).toEqual([
      ["page", 0],
      ["card", 1],
      ["button", 2],
    ]);
  });
});

describe("lockProps", () => {
  it("makes a locked element unselectable and immovable on the canvas", () => {
    expect(lockProps(true)).toEqual({
      selectable: false,
      evented: false,
      lockMovementX: true,
      lockMovementY: true,
      lockScalingX: true,
      lockScalingY: true,
      lockRotation: true,
    });
    expect(lockProps(false).selectable).toBe(true);
    expect(lockProps(false).lockMovementX).toBe(false);
  });
});

describe("layerIcon", () => {
  it("names the icon from the node kind and the Fabric shape", () => {
    expect(layerIcon({ kind: "frame" })).toBe("frame");
    expect(layerIcon({ kind: "capture", type: "Image" })).toBe("capture");
    expect(layerIcon({ kind: "vector_drawing", type: "Rect" })).toBe("rect");
    expect(layerIcon({ kind: "vector_drawing", type: "Ellipse" })).toBe("ellipse");
    expect(layerIcon({ kind: "vector_drawing", type: "Polygon" })).toBe("polygon");
    expect(layerIcon({ kind: "vector_drawing", type: "Line" })).toBe("line");
    expect(layerIcon({ kind: "vector_drawing", type: "IText" })).toBe("text");
    // A live Fabric object reports "i-text"; its JSON says "IText".
    expect(layerIcon({ kind: "vector_drawing", type: "i-text" })).toBe("text");
    expect(layerIcon({ kind: "vector_drawing", type: "Path", shape: "arrow" })).toBe("arrow");
    expect(layerIcon({ kind: "vector_drawing", type: "Path", shape: "cross" })).toBe("cross");
    expect(layerIcon({ kind: "vector_drawing", type: "Path" })).toBe("path");
    expect(layerIcon({ kind: "group" })).toBe("group");
  });
});

describe("hasInstructions", () => {
  it("counts only text that says something", () => {
    expect(hasInstructions("Make it red")).toBe(true);
    expect(hasInstructions("  \n ")).toBe(false);
    expect(hasInstructions(undefined)).toBe(false);
  });
});

describe("instructionCoverage", () => {
  it("counts elements with instructions over all elements, group rows aside", () => {
    const item = (id: string, instructed: boolean, kind: "vector_drawing" | "group" = "vector_drawing") => ({
      id, name: id, kind, hidden: false, locked: false, instructed,
    });
    expect(instructionCoverage([item("a", true), item("b", false), item("c", true), item("g", true, "group")])).toEqual({ covered: 2, total: 3 });
  });
});
