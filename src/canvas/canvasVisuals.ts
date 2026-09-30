import type { Box, Pt } from "./geometry";

/** Scene spacing of the canvas dot grid (mockup: 1 px dots every 20 px). */
const GRID = 20;
/** Below this on-screen spacing the grid doubles, so dots never turn into a grey wash. */
const GRID_MIN = 8;

/** CSS background size and offset of the dot grid for a Fabric viewport transform. */
export function gridBackground(vpt: readonly number[]): { size: number; x: number; y: number } {
  let size = GRID * vpt[0];
  while (size < GRID_MIN) size *= 2;
  return { size, x: vpt[4], y: vpt[5] };
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;
}

/**
 * Link from box `a` to box `b` as a cubic curve (mockup): it leaves the side of
 * `a` facing `b`, lands on the opposite side of `b`, with tangents along the main
 * axis. Null when the boxes overlap.
 */
export function linkCurve(a: Box, b: Box): { from: Pt; to: Pt; c1: Pt; c2: Pt } | null {
  if (overlaps(a, b)) return null;
  const ca = { x: a.left + a.width / 2, y: a.top + a.height / 2 };
  const cb = { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  if (Math.abs(cb.x - ca.x) >= Math.abs(cb.y - ca.y)) {
    const right = cb.x > ca.x;
    const from = { x: right ? a.left + a.width : a.left, y: ca.y };
    const to = { x: right ? b.left : b.left + b.width, y: cb.y };
    const mid = (to.x - from.x) / 2;
    return { from, to, c1: { x: from.x + mid, y: from.y }, c2: { x: to.x - mid, y: to.y } };
  }
  const down = cb.y > ca.y;
  const from = { x: ca.x, y: down ? a.top + a.height : a.top };
  const to = { x: cb.x, y: down ? b.top : b.top + b.height };
  const mid = (to.y - from.y) / 2;
  return { from, to, c1: { x: from.x, y: from.y + mid }, c2: { x: to.x, y: to.y - mid } };
}

export function bezierPoint(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  const at = (a: number, b: number, c: number, d: number) => u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
  return { x: at(p0.x, p1.x, p2.x, p3.x), y: at(p0.y, p1.y, p2.y, p3.y) };
}

/** Screen positions of the size chip (under the selection) and the boolean bar (34 px below). */
export function selectionOverlay(screen: Box, size: { width: number; height: number }) {
  const bottom = screen.top + screen.height;
  return {
    chip: { x: screen.left + screen.width / 2, y: bottom + 7, label: `${Math.round(size.width)} × ${Math.round(size.height)}` },
    bar: { x: screen.left, y: bottom + 34 },
  };
}
