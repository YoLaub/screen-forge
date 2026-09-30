import { describe, expect, it } from "vitest";
import { THEMES, cssVariables, themeFor } from "./tokens";

describe("THEMES", () => {
  it("defines the same tokens in light and dark", () => {
    expect(Object.keys(THEMES.dark).sort()).toEqual(Object.keys(THEMES.light).sort());
  });

  it("uses the mockup's accent and agent colors", () => {
    expect(THEMES.light.acc).toBe("#0a7f97");
    expect(THEMES.light.ag).toBe("#a92fbb");
    expect(THEMES.dark.acc).toBe("#2fc7df");
    expect(THEMES.dark.ag).toBe("#e279f0");
  });
});

describe("cssVariables", () => {
  it("writes one custom property per token, camelCase as kebab-case", () => {
    const css = cssVariables({ panel: "#fff", accSoft: "rgba(0,0,0,.1)" });
    expect(css).toBe("--panel: #fff; --acc-soft: rgba(0,0,0,.1);");
  });
});

describe("themeFor", () => {
  it("follows the system appearance", () => {
    expect(themeFor(true)).toBe(THEMES.dark);
    expect(themeFor(false)).toBe(THEMES.light);
  });
});
