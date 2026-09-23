import { describe, expect, it } from "vitest";
import { addLink, pruneLinks, removeLink, toConnections, updateLink } from "./links";

const a = { target_node: "a", trigger: "onClick", payload_type: "" };
const b = { target_node: "b", trigger: "", payload_type: "User" };

describe("link helpers", () => {
  it("add, update and remove without mutating the input", () => {
    const links = [a];
    expect(addLink(links, "b")).toEqual([a, { target_node: "b", trigger: "", payload_type: "" }]);
    expect(updateLink(links, 0, { trigger: "onHover" })).toEqual([{ ...a, trigger: "onHover" }]);
    expect(removeLink([a, b], 0)).toEqual([b]);
    expect(links).toEqual([a]);
  });

  it("drops links whose target no longer exists", () => {
    expect(pruneLinks([a, b], new Set(["b"]))).toEqual([b]);
  });

  it("maps to sf-core connections, omitting empty fields", () => {
    expect(toConnections([a, b])).toEqual([
      { target_node: "a", trigger: "onClick" },
      { target_node: "b", payload_type: "User" },
    ]);
  });
});
