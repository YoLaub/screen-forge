import { describe, expect, it } from "vitest";
import { newNodeId, nextNodeName, toNodeRecord } from "./nodeRecord";

describe("newNodeId", () => {
  it("prefixes by kind and only uses id-safe characters", () => {
    expect(newNodeId("capture")).toMatch(/^cap_[a-z0-9]{8}$/);
    expect(newNodeId("vector_drawing")).toMatch(/^vec_[a-z0-9]{8}$/);
    expect(newNodeId("frame")).toMatch(/^frm_[a-z0-9]{8}$/);
  });

  it("does not repeat", () => {
    const ids = new Set(Array.from({ length: 200 }, () => newNodeId("capture")));
    expect(ids.size).toBe(200);
  });
});

describe("nextNodeName", () => {
  it("numbers after the highest existing name of the same kind", () => {
    expect(nextNodeName("capture", [])).toBe("Capture 1");
    expect(nextNodeName("capture", ["Capture 1", "Capture 4", "Rectangle 9"])).toBe("Capture 5");
    expect(nextNodeName("vector_drawing", ["Capture 2"])).toBe("Rectangle 1");
    expect(nextNodeName("frame", ["Frame 1"])).toBe("Frame 2");
  });
});

describe("toNodeRecord", () => {
  it("builds the sf-core node with scaled, rounded dimensions", () => {
    expect(
      toNodeRecord({
        sfId: "cap_abcd1234",
        sfKind: "capture",
        sfName: "Capture 1",
        sfInstructions: "Fix the border",
        width: 100,
        height: 40.4,
        scaleX: 1.5,
        scaleY: 2,
      }),
    ).toEqual({
      id: "cap_abcd1234",
      type: "capture",
      name: "Capture 1",
      dimensions: { width: 150, height: 81 },
      colors_detected: [],
      connections: [],
      user_instructions: "Fix the border",
    });
  });

  it("exports links as connections", () => {
    const record = toNodeRecord({
      sfId: "vec_1",
      sfKind: "vector_drawing",
      sfName: "Form",
      sfInstructions: "",
      sfLinks: [{ target_node: "cap_2", trigger: "onError", payload_type: "" }],
      width: 10,
      height: 10,
      scaleX: 1,
      scaleY: 1,
    });
    expect(record.connections).toEqual([{ target_node: "cap_2", trigger: "onError" }]);
  });

  it("adds the position and the parent frame", () => {
    const record = toNodeRecord(
      {
        sfId: "vec_1",
        sfKind: "vector_drawing",
        sfName: "Button",
        sfInstructions: "",
        width: 10,
        height: 10,
        scaleX: 1,
        scaleY: 1,
      },
      { left: 12.4, top: -3.6, width: 10, height: 10 },
      "frm_1",
    );
    expect(record.position).toEqual({ x: 12, y: -4 });
    expect(record.parent).toBe("frm_1");
  });
});
