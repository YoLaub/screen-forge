import { describe, expect, it } from "vitest";
import { expandToGroups, newGroupId, withGroupRows } from "./groups";
import { layerRows, type LayerItem } from "./layers";

const item = (id: string, extra: Partial<LayerItem> = {}): LayerItem => ({
  id,
  name: id,
  kind: "vector_drawing",
  hidden: false,
  locked: false,
  ...extra,
});
const form = { id: "grp_form", name: "Form" };

describe("newGroupId", () => {
  it("uses the grp_ prefix and id-safe characters", () => {
    expect(newGroupId()).toMatch(/^grp_[a-z0-9]+$/);
  });
});

describe("expandToGroups", () => {
  const nodes = [{ id: "a", group: "g" }, { id: "b", group: "g" }, { id: "c" }];

  it("adds the other members of every selected group", () => {
    expect(expandToGroups(["a"], nodes).sort()).toEqual(["a", "b"]);
    expect(expandToGroups(["c"], nodes)).toEqual(["c"]);
  });
});

describe("withGroupRows", () => {
  it("puts a group row where its topmost member was, with its members under it", () => {
    // Bottom to top: a (in group), x, b (in group).
    const items = [item("a", { group: form }), item("x"), item("b", { group: form })];
    const rows = layerRows(withGroupRows(items)).map((r) => [r.item.id, r.depth]);
    expect(rows).toEqual([
      ["grp_form", 0],
      ["b", 1],
      ["a", 1],
      ["x", 0],
    ]);
  });

  it("keeps a grouped frame's content nesting and marks the group hidden or locked only when all members are", () => {
    const items = [
      item("frm", { kind: "frame" }),
      item("a", { parent: "frm", group: form, hidden: true }),
      item("b", { parent: "frm", group: form, hidden: true, locked: true }),
    ];
    const withGroups = withGroupRows(items);
    const group = withGroups.find((i) => i.id === "grp_form")!;
    expect(group).toMatchObject({ kind: "group", name: "Form", parent: "frm", hidden: true, locked: false });
    expect(layerRows(withGroups).map((r) => [r.item.id, r.depth])).toEqual([
      ["frm", 0],
      ["grp_form", 1],
      ["b", 2],
      ["a", 2],
    ]);
  });
});
