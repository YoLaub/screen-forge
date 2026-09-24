import { describe, expect, it } from "vitest";
import { firstImageFile } from "./imageFile";

const file = (name: string, type: string) => new File([new Uint8Array([1])], name, { type });

describe("firstImageFile", () => {
  it("returns the first image among dropped or pasted files", () => {
    const png = file("shot.png", "image/png");
    expect(firstImageFile([file("notes.txt", "text/plain"), png, file("b.jpg", "image/jpeg")])).toBe(png);
  });

  it("returns undefined when there is no image or no file list", () => {
    expect(firstImageFile([file("notes.txt", "text/plain")])).toBeUndefined();
    expect(firstImageFile(undefined)).toBeUndefined();
  });
});
