import { describe, expect, it } from "vitest";
import { dataUrlToBase64, wrapSvg } from "./exportNode";

describe("wrapSvg", () => {
  it("wraps an object fragment in a standalone svg framed on its bounds", () => {
    expect(wrapSvg("<rect/>", { left: 10, top: 20, width: 100, height: 50 })).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50" viewBox="10 20 100 50"><rect/></svg>',
    );
  });
});

describe("dataUrlToBase64", () => {
  it("strips the data URL prefix", () => {
    expect(dataUrlToBase64("data:image/png;base64,AQID")).toBe("AQID");
  });

  it("rejects anything that is not a base64 PNG data URL", () => {
    expect(() => dataUrlToBase64("data:image/jpeg;base64,AQID")).toThrow();
  });
});
