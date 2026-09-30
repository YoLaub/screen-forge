import { describe, expect, it } from "vitest";
import { flattenScale, mergedNodeProps } from "./flatten";
import type { SfProps } from "./nodeRecord";

const link = (target_node: string) => ({ target_node, trigger: "", payload_type: "" });
const node = (id: string, name: string, instructions = "", links: string[] = []): SfProps => ({
  sfId: id,
  sfKind: "vector_drawing",
  sfName: name,
  sfInstructions: instructions,
  sfLinks: links.map(link),
});

describe("mergedNodeProps", () => {
  it("keeps every source's instructions, labeled by its name", () => {
    const merged = mergedNodeProps([node("a", "Header", "Make it sticky"), node("b", "Logo"), node("c", "Button", "Red")]);
    expect(merged.sfInstructions).toBe("Header: Make it sticky\nButton: Red");
  });

  it("keeps links going out of the merged set, once each", () => {
    const merged = mergedNodeProps([node("a", "A", "", ["b", "z"]), node("b", "B", "", ["z", "y"])]);
    expect(merged.sfLinks!.map((l) => l.target_node)).toEqual(["z", "y"]);
  });
});

describe("flattenScale", () => {
  const box = { left: 0, top: 0, width: 400, height: 200 };

  it("renders at the finest capture resolution in the merge", () => {
    expect(flattenScale(box, [0.5, 0.25])).toBe(4);
    expect(flattenScale(box, [])).toBe(2);
  });

  it("caps the longest side", () => {
    expect(flattenScale({ ...box, width: 8000 }, [0.1])).toBe(1);
  });
});
