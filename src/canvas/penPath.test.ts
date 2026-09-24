import { describe, expect, it } from "vitest";
import { type Anchor, hitAnchor, hitHandle, moveAnchor, moveHandle, smoothAnchor, toSvgPath } from "./penPath";

const corner = (x: number, y: number): Anchor => ({ x, y });

describe("smoothAnchor", () => {
  it("puts the out handle where the drag ends and mirrors the in handle", () => {
    expect(smoothAnchor({ x: 10, y: 10 }, { x: 30, y: 20 })).toEqual({
      x: 10,
      y: 10,
      out: { x: 30, y: 20 },
      in: { x: -10, y: 0 },
    });
  });
});

describe("toSvgPath", () => {
  it("draws straight segments between corner points", () => {
    expect(toSvgPath([corner(0, 0), corner(10, 0), corner(10, 10)], false)).toBe("M 0 0 L 10 0 L 10 10");
  });

  it("closes the path back to the first point", () => {
    expect(toSvgPath([corner(0, 0), corner(10, 0), corner(10, 10)], true)).toBe("M 0 0 L 10 0 L 10 10 L 0 0 Z");
  });

  it("uses cubic curves when a handle is involved", () => {
    const a = { x: 0, y: 0, out: { x: 5, y: -5 } };
    const b = { x: 20, y: 0, in: { x: 15, y: -5 } };
    expect(toSvgPath([a, b], false)).toBe("M 0 0 C 5 -5 15 -5 20 0");
  });

  it("uses the point itself for a missing handle", () => {
    expect(toSvgPath([{ x: 0, y: 0, out: { x: 5, y: 5 } }, corner(20, 0)], false)).toBe("M 0 0 C 5 5 20 0 20 0");
  });
});

describe("hit testing", () => {
  const path: Anchor[] = [corner(0, 0), { x: 100, y: 0, in: { x: 80, y: -20 }, out: { x: 120, y: 20 } }];

  it("finds the anchor under the cursor within the tolerance", () => {
    expect(hitAnchor(path, { x: 98, y: 3 }, 5)).toBe(1);
    expect(hitAnchor(path, { x: 50, y: 50 }, 5)).toBe(-1);
  });

  it("finds a handle and which one it is", () => {
    expect(hitHandle(path, { x: 121, y: 19 }, 5)).toEqual({ index: 1, which: "out" });
    expect(hitHandle(path, { x: 0, y: 0 }, 5)).toBeNull();
  });
});

describe("editing", () => {
  const path: Anchor[] = [corner(0, 0), { x: 100, y: 0, in: { x: 80, y: 0 }, out: { x: 120, y: 0 } }];

  it("moves an anchor with its handles", () => {
    expect(moveAnchor(path, 1, { x: 100, y: 50 })[1]).toEqual({
      x: 100,
      y: 50,
      in: { x: 80, y: 50 },
      out: { x: 120, y: 50 },
    });
    expect(path[1].y).toBe(0);
  });

  it("mirrors the other handle unless the handles are independent", () => {
    expect(moveHandle(path, 1, "out", { x: 100, y: 30 }, false)[1]).toEqual({
      x: 100,
      y: 0,
      out: { x: 100, y: 30 },
      in: { x: 100, y: -30 },
    });
    expect(moveHandle(path, 1, "out", { x: 100, y: 30 }, true)[1].in).toEqual({ x: 80, y: 0 });
  });
});
