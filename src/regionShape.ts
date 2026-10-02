export interface Point {
  x: number;
  y: number;
}

/** What the user drew, as the backend expects it (logical pixels from the screen's top left). */
export type RegionShape = { kind: "rect"; x: number; y: number; w: number; h: number } | { kind: "path"; points: Point[] };

/** Fewest pixels a side must have, like the backend's. */
const MIN_SIDE = 4;
/** A new outline point is kept only when the pointer moved this far from the last one. */
const MIN_STEP = 3;

export function dragRect(from: Point, to: Point): RegionShape {
  return { kind: "rect", x: Math.min(from.x, to.x), y: Math.min(from.y, to.y), w: Math.abs(to.x - from.x), h: Math.abs(to.y - from.y) };
}

export function addPoint(points: Point[], next: Point): Point[] {
  const last = points[points.length - 1];
  if (last && Math.hypot(next.x - last.x, next.y - last.y) < MIN_STEP) return points;
  return [...points, next];
}

export function isUsable(shape: RegionShape): boolean {
  if (shape.kind === "path") return shape.points.length >= 3;
  return shape.w >= MIN_SIDE && shape.h >= MIN_SIDE;
}

/** SVG path of a closed outline, "" when there is nothing to draw. */
export function outlinePath(points: Point[]): string {
  return points.length === 0 ? "" : `${points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join("")}Z`;
}
