import { describe, expect, it } from "vitest";
import { arrowBetween, arrowHead } from "./geometry";

const box = (left: number, top: number, width: number, height: number) => ({ left, top, width, height });

describe("arrowBetween", () => {
  it("runs from the edge of the source to the edge of the target", () => {
    // Two 100x100 boxes side by side, centers at y=50.
    expect(arrowBetween(box(0, 0, 100, 100), box(300, 0, 100, 100))).toEqual({
      from: { x: 100, y: 50 },
      to: { x: 300, y: 50 },
    });
  });

  it("exits through the top or bottom when the target is mostly vertical", () => {
    const { from, to } = arrowBetween(box(0, 0, 100, 100), box(0, 400, 100, 100))!;
    expect(from).toEqual({ x: 50, y: 100 });
    expect(to).toEqual({ x: 50, y: 400 });
  });

  it("returns null when the boxes overlap", () => {
    expect(arrowBetween(box(0, 0, 100, 100), box(50, 50, 100, 100))).toBeNull();
  });
});

describe("arrowHead", () => {
  it("draws two barbs behind the tip, symmetric around the shaft", () => {
    const [left, right] = arrowHead({ x: 0, y: 0 }, { x: 100, y: 0 }, 10);
    expect(left.x).toBeCloseTo(100 - 10 * Math.cos(Math.PI / 6));
    expect(right.x).toBeCloseTo(left.x);
    expect(left.y).toBeCloseTo(-right.y);
    expect(Math.abs(left.y)).toBeCloseTo(10 * Math.sin(Math.PI / 6));
  });
});
