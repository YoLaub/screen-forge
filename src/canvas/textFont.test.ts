import { describe, expect, it } from "vitest";
import { TEXT_FONT, withTextFont } from "./textFont";

const canvas = (objects: object[]) => JSON.stringify({ version: "7", objects });

describe("withTextFont", () => {
  it("moves texts saved with the system font to the canvas text font", () => {
    const json = withTextFont(canvas([{ type: "IText", text: "Hi", fontFamily: "system-ui, sans-serif" }]));
    expect(JSON.parse(json).objects[0].fontFamily).toBe(TEXT_FONT);
  });

  it("leaves other objects and other fonts alone", () => {
    const objects = [
      { type: "Rect", width: 10 },
      { type: "IText", text: "Hi", fontFamily: "Georgia" },
    ];
    expect(JSON.parse(withTextFont(canvas(objects))).objects).toEqual(objects);
  });

  it("does not use the system font, whose widths Fabric mismeasures", () => {
    expect(TEXT_FONT).not.toMatch(/system-ui|-apple-system/);
  });
});
