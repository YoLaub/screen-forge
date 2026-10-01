/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { colorLiterals, paletteClasses } from "./colorGuard";

describe("paletteClasses", () => {
  it("finds Tailwind palette colors, which escape the theme", () => {
    expect(paletteClasses('className="bg-neutral-100 text-red-600 hover:bg-white bg-black/20"')).toEqual([
      "bg-neutral-100",
      "text-red-600",
      "bg-white",
      "bg-black/20",
    ]);
  });

  it("lets theme token classes through", () => {
    expect(paletteClasses('className="bg-panel text-tx2 border-line2 hover:bg-hover text-acc-tx"')).toEqual([]);
  });
});

describe("colorLiterals", () => {
  it("finds hex and rgb colors", () => {
    expect(colorLiterals('fill: "#e5e7eb", stroke: "#FFF", c: rgba(0, 0, 0, .2)')).toEqual(["#e5e7eb", "#FFF", "rgba("]);
  });

  it("ignores ids and anchors that are not colors", () => {
    expect(colorLiterals('href="#t2" id: "#abcdefgh1"')).toEqual([]);
  });
});

// Colors live in the theme (UI) and in the drawing defaults (saved content).
const ALLOWED = ["src/theme/tokens.ts", "src/canvas/drawingDefaults.ts"];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx|css)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("repository colors", () => {
  const root = join(__dirname, "..", "..");
  const files = sources(join(root, "src")).map((f) => relative(root, f));

  it("scans the app sources", () => {
    expect(files).toContain("src/canvas/CanvasView.tsx");
    expect(files).toContain("src/App.tsx");
  });

  it("has no color outside the theme and the drawing defaults", () => {
    const found = files
      .filter((f) => !ALLOWED.includes(f))
      .flatMap((f) => {
        const text = readFileSync(join(root, f), "utf8");
        return [...paletteClasses(text), ...colorLiterals(text)].map((c) => `${f}: ${c}`);
      });
    expect(found).toEqual([]);
  });
});
