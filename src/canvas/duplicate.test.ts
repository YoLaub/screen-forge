import { describe, expect, it } from "vitest";
import { duplicateProps } from "./duplicate";
import type { SfProps } from "./nodeRecord";

const node = (id: string, name: string, links: string[] = []): SfProps => ({
  sfId: id,
  sfKind: "vector_drawing",
  sfName: name,
  sfInstructions: "keep it",
  sfLinks: links.map((target_node) => ({ target_node, trigger: "", payload_type: "" })),
});

let counter = 0;
const newId = () => `vec_new${++counter}`;

describe("duplicateProps", () => {
  it("gives each copy a new id and a copy name, keeping its instructions", () => {
    const [copy] = duplicateProps([node("vec_a", "Rectangle 1")], newId);
    expect(copy.sfId).toMatch(/^vec_new/);
    expect(copy.sfName).toBe("Rectangle 1 copy");
    expect(copy.sfInstructions).toBe("keep it");
  });

  it("keeps links to nodes outside the duplicated set", () => {
    const [copy] = duplicateProps([node("vec_a", "A", ["vec_z"])], newId);
    expect(copy.sfLinks).toEqual([{ target_node: "vec_z", trigger: "", payload_type: "" }]);
  });

  it("points links between duplicated nodes at their copies", () => {
    const [a, b] = duplicateProps([node("vec_a", "A", ["vec_b"]), node("vec_b", "B")], newId);
    expect(a.sfLinks).toEqual([{ target_node: b.sfId, trigger: "", payload_type: "" }]);
  });

  it("does not share the links array with the original", () => {
    const original = node("vec_a", "A", ["vec_z"]);
    const [copy] = duplicateProps([original], newId);
    copy.sfLinks!.push({ target_node: "vec_y", trigger: "", payload_type: "" });
    expect(original.sfLinks).toHaveLength(1);
  });
});

describe("duplicateProps on serialized objects", () => {
  it("returns only the ScreenForge node props, not the drawing props of the source", () => {
    const serialized = { ...node("vec_a", "A"), type: "Rect", left: 10, fill: { type: "linear" } };
    const [copy] = duplicateProps([serialized], newId);
    expect(copy).not.toHaveProperty("type");
    expect(copy).not.toHaveProperty("left");
    expect(copy).not.toHaveProperty("fill");
  });
});

describe("duplicateProps with groups", () => {
  const inGroup = (id: string): SfProps => ({ ...node(id, id), sfGroup: { id: "grp_1", name: "Card" } });

  it("makes copies of several members of a group a new group", () => {
    const [a, b] = duplicateProps([inGroup("vec_a"), inGroup("vec_b")], newId);
    expect(a.sfGroup!.id).not.toBe("grp_1");
    expect(a.sfGroup).toEqual(b.sfGroup);
    expect(a.sfGroup!.name).toBe("Card copy");
  });

  it("keeps a lone copied member in its group", () => {
    const [a] = duplicateProps([inGroup("vec_a")], newId);
    expect(a.sfGroup).toEqual({ id: "grp_1", name: "Card" });
  });
});
