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
