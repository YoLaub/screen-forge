import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";
import { THEMES, appTints, cssVariables, themeFor } from "./tokens";

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

/** Hue of a #rrggbb color, in degrees. */
function hueOf(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

describe("appTints", () => {
  const apps = ["Safari", "Google Chrome", "Simulator", "Code", "Terminal", "Figma", "Slack", "Notion"];

  it("gives each listed app a color, the same on every call", () => {
    expect(appTints(apps)).toEqual(appTints(apps));
    expect(Object.keys(appTints(apps))).toEqual(apps);
    expect(appTints(apps)["Safari"]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("spreads the hues so neighbours in the list are easy to tell apart (at least 20 degrees)", () => {
    const hues = Object.values(appTints(apps)).map(hueOf).sort((a, b) => a - b);
    const gaps = hues.map((h, i) => (i === 0 ? 360 - hues[hues.length - 1] + h : h - hues[i - 1]));
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(20);
  });

  it("keeps a white letter readable on any app color (3:1)", () => {
    const many = Array.from({ length: 360 }, (_, i) => `App ${i}`);
    for (const tint of Object.values(appTints(many))) expect(contrastRatio(tint, THEMES.light.tintTx)).toBeGreaterThanOrEqual(3);
  });

  it("ignores duplicates", () => {
    expect(Object.keys(appTints(["A", "B", "A"]))).toEqual(["A", "B"]);
  });
});
