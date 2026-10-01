import { describe, expect, it } from "vitest";
import { DEFAULT_EXPORT, parseExportSettings, usesQuality, withExtension } from "./exportOptions";

describe("withExtension", () => {
  it("swaps the extension for the chosen format", () => {
    expect(withExtension("Login.png", "jpg")).toBe("Login.jpg");
    expect(withExtension("Login.png", "webp")).toBe("Login.webp");
    expect(withExtension("Login.png", "png")).toBe("Login.png");
  });

  it("keeps dots inside the name", () => {
    expect(withExtension("v1.2 home.png", "jpg")).toBe("v1.2 home.jpg");
  });

  it("adds an extension to a name that has none", () => {
    expect(withExtension("export", "webp")).toBe("export.webp");
  });
});

describe("usesQuality", () => {
  it("applies to lossy formats only", () => {
    expect(usesQuality("jpg")).toBe(true);
    expect(usesQuality("webp")).toBe(true);
    expect(usesQuality("png")).toBe(false);
  });
});

describe("parseExportSettings", () => {
  it("reads saved settings", () => {
    expect(parseExportSettings('{"format":"webp","quality":"low"}')).toEqual({ format: "webp", quality: "low" });
  });

  it("falls back to the defaults on anything unusable", () => {
    expect(parseExportSettings(null)).toEqual(DEFAULT_EXPORT);
    expect(parseExportSettings("not json")).toEqual(DEFAULT_EXPORT);
    expect(parseExportSettings('{"format":"gif","quality":"max"}')).toEqual(DEFAULT_EXPORT);
  });

  it("keeps the valid half of a partly valid value", () => {
    expect(parseExportSettings('{"format":"jpg","quality":"max"}')).toEqual({ format: "jpg", quality: DEFAULT_EXPORT.quality });
  });
});
