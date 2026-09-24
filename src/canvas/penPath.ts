import type { Pt } from "./geometry";

/** A path point with optional Bézier handles, all in the same coordinates. */
export interface Anchor {
  x: number;
  y: number;
  in?: Pt;
  out?: Pt;
}

export type HandleSide = "in" | "out";

const fmt = (n: number) => String(Math.round(n * 100) / 100);
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const mirror = (center: Pt, p: Pt): Pt => ({ x: 2 * center.x - p.x, y: 2 * center.y - p.y });

/** A smooth point at `at`, its out handle where the drag ended, the in handle mirrored. */
export function smoothAnchor(at: Pt, dragTo: Pt): Anchor {
  return { x: at.x, y: at.y, out: { x: dragTo.x, y: dragTo.y }, in: mirror(at, dragTo) };
}

function segment(from: Anchor, to: Anchor): string {
  if (!from.out && !to.in) return `L ${fmt(to.x)} ${fmt(to.y)}`;
  const c1 = from.out ?? from;
  const c2 = to.in ?? to;
  return `C ${fmt(c1.x)} ${fmt(c1.y)} ${fmt(c2.x)} ${fmt(c2.y)} ${fmt(to.x)} ${fmt(to.y)}`;
}

/** SVG path data through `anchors`; `closed` links the last point back to the first. */
export function toSvgPath(anchors: Anchor[], closed: boolean): string {
  if (anchors.length === 0) return "";
  const parts = [`M ${fmt(anchors[0].x)} ${fmt(anchors[0].y)}`];
  for (let i = 1; i < anchors.length; i++) parts.push(segment(anchors[i - 1], anchors[i]));
  if (closed && anchors.length > 2) parts.push(segment(anchors[anchors.length - 1], anchors[0]), "Z");
  return parts.join(" ");
}

/** Index of the anchor within `tolerance` of `p`, or -1. */
export function hitAnchor(anchors: Anchor[], p: Pt, tolerance: number): number {
  return anchors.findIndex((a) => dist(a, p) <= tolerance);
}

/** The handle within `tolerance` of `p`, if any. */
export function hitHandle(
  anchors: Anchor[],
  p: Pt,
  tolerance: number,
): { index: number; which: HandleSide } | null {
  for (let index = 0; index < anchors.length; index++) {
    for (const which of ["in", "out"] as const) {
      const h = anchors[index][which];
      if (h && dist(h, p) <= tolerance) return { index, which };
    }
  }
  return null;
}

/** Moves anchor `i` to `p`, its handles along with it. */
export function moveAnchor(anchors: Anchor[], i: number, p: Pt): Anchor[] {
  const a = anchors[i];
  const dx = p.x - a.x;
  const dy = p.y - a.y;
  const shift = (h?: Pt) => h && { x: h.x + dx, y: h.y + dy };
  const moved: Anchor = { x: p.x, y: p.y };
  if (a.in) moved.in = shift(a.in);
  if (a.out) moved.out = shift(a.out);
  return anchors.map((x, j) => (j === i ? moved : x));
}

/**
 * Moves one handle of anchor `i` to `p`. The other handle mirrors it (smooth
 * point) unless `independent` is set (a corner with two different handles).
 */
export function moveHandle(anchors: Anchor[], i: number, which: HandleSide, p: Pt, independent: boolean): Anchor[] {
  const a = anchors[i];
  const other: HandleSide = which === "in" ? "out" : "in";
  const moved: Anchor = { ...a, [which]: { x: p.x, y: p.y } };
  if (!independent) moved[other] = mirror(a, p);
  return anchors.map((x, j) => (j === i ? moved : x));
}
