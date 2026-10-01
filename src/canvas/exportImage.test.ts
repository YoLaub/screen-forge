import { describe, expect, it } from "vitest";
import { exportFileName, exportTarget } from "./exportImage";

describe("exportTarget", () => {
  it("exports the whole canvas when nothing is selected, named after the project", () => {
    expect(exportTarget([], "my-app")).toEqual({ scope: "canvas", label: "Export canvas", fileName: "my-app.png" });
  });

  it("exports a selected frame with its content", () => {
    expect(exportTarget([{ kind: "frame", name: "Login" }], "p")).toEqual({ scope: "frame", label: "Export frame", fileName: "Login.png" });
  });

  it("exports a single element on its own", () => {
    expect(exportTarget([{ kind: "vector_drawing", name: "Button" }], "p")).toEqual({ scope: "node", label: "Export element", fileName: "Button.png" });
  });

  it("exports several elements as the region they cover", () => {
    const picked = [
      { kind: "vector_drawing" as const, name: "A" },
      { kind: "capture" as const, name: "B" },
    ];
    expect(exportTarget(picked, "p")).toEqual({ scope: "region", label: "Export selection", fileName: "selection.png" });
  });
});

describe("exportFileName", () => {
  it("drops characters macOS rejects and keeps the rest", () => {
    expect(exportFileName("Login / Sign up: v2")).toBe("Login - Sign up - v2.png");
  });

  it("falls back to a default for an empty name", () => {
    expect(exportFileName("  ")).toBe("export.png");
  });
});
