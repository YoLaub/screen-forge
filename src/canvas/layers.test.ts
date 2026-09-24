import { describe, expect, it } from "vitest";
import { type LayerItem, layerRows, lockProps } from "./layers";

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
