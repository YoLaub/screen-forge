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
    expect(nextNodeName("vector_drawing", ["Ellipse 2", "Rectangle 5"], "Ellipse")).toBe("Ellipse 3");
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
      { bounds: { left: 12.4, top: -3.6, width: 10, height: 10 }, parent: "frm_1" },
    );
    expect(record.position).toEqual({ x: 12, y: -4 });
    expect(record.parent).toBe("frm_1");
  });

  it("carries the content of a text element", () => {
    const obj = {
      sfId: "vec_t",
      sfKind: "vector_drawing" as const,
      sfName: "Text 1",
      sfInstructions: "",
      width: 10,
      height: 10,
      scaleX: 1,
      scaleY: 1,
    };
    expect(toNodeRecord(obj, { text: "Connexion" }).text).toBe("Connexion");
    expect(toNodeRecord(obj)).not.toHaveProperty("text");
  });

  it("carries the style and lists its colors for the agent", () => {
    const obj = {
      sfId: "vec_b",
      sfKind: "vector_drawing" as const,
      sfName: "Button",
      sfInstructions: "",
      width: 10,
      height: 10,
      scaleX: 1,
      scaleY: 1,
    };
    const record = toNodeRecord(obj, { style: { fill: "#3B82F6", stroke: "#1D4ED8", stroke_width: 1, radius: 8 } });
    expect(record.style).toEqual({ fill: "#3B82F6", stroke: "#1D4ED8", stroke_width: 1, radius: 8 });
    expect(record.colors_detected).toEqual(["#3B82F6", "#1D4ED8"]);
  });

  it("exports the given links instead of the stored ones (hidden targets filtered out)", () => {
    const obj = {
      sfId: "vec_l",
      sfKind: "vector_drawing" as const,
      sfName: "Form",
      sfInstructions: "",
      sfLinks: [{ target_node: "hidden", trigger: "onClick", payload_type: "" }],
      width: 10,
      height: 10,
      scaleX: 1,
      scaleY: 1,
    };
    expect(toNodeRecord(obj, { links: [] }).connections).toEqual([]);
  });
});

describe("toNodeRecord groups", () => {
  it("tells the agent which group a node belongs to", () => {
    const obj = {
      sfId: "vec_1",
      sfKind: "vector_drawing" as const,
      sfName: "Field",
      sfInstructions: "",
      sfGroup: { id: "grp_1", name: "Login form" },
      width: 10,
      height: 10,
      scaleX: 1,
      scaleY: 1,
    };
    expect(toNodeRecord(obj).group).toEqual({ id: "grp_1", name: "Login form" });
  });
});

describe("toNodeRecord captures", () => {
  const capture = {
    sfId: "cap_1",
    sfKind: "capture" as const,
    sfName: "Safari — Sign in",
    sfInstructions: "",
    width: 1280,
    height: 864,
    scaleX: 1,
    scaleY: 1,
  };

  it("tells the agent which app a capture comes from and when, as an ISO time", () => {
    const at = Date.UTC(2026, 9, 1, 14, 1, 0);
    const record = toNodeRecord({ ...capture, sfSource: "Safari", sfCapturedAt: at });
    expect(record.source).toBe("Safari");
    expect(record.captured_at).toBe("2026-10-01T14:01:00.000Z");
  });

  it("leaves both out when they are not known (pasted image, canvas saved before)", () => {
    const record = toNodeRecord(capture);
    expect(record).not.toHaveProperty("source");
    expect(record).not.toHaveProperty("captured_at");
  });

  it("keeps the time of an image that was pasted or dropped, without inventing an app", () => {
    const record = toNodeRecord({ ...capture, sfCapturedAt: Date.UTC(2026, 9, 1, 8, 0, 0) });
    expect(record.captured_at).toBe("2026-10-01T08:00:00.000Z");
    expect(record).not.toHaveProperty("source");
  });
});
