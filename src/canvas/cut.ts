import type { Box, Pt } from "./geometry";

/** A 2D affine matrix in canvas order [a, b, c, d, e, f]. */
export type Matrix = readonly [number, number, number, number, number, number];

/** Smallest side, in image pixels, of a piece worth cutting. */
const MIN_PIECE = 2;

/**
 * Scene points in the pixels of an image `width` x `height`, given the inverse
 * of its transform (which maps the scene to coordinates around its center).
 */
export function toImagePoints(points: Pt[], inverse: Matrix, width: number, height: number): Pt[] {
  const [a, b, c, d, e, f] = inverse;
  return points.map(({ x, y }) => ({ x: a * x + c * y + e + width / 2, y: b * x + d * y + f + height / 2 }));
}

/** Corners of the box dragged between two points, clockwise from the top left. */
export function rectPolygon(p: Pt, q: Pt): Pt[] {
  const left = Math.min(p.x, q.x);
  const right = Math.max(p.x, q.x);
  const top = Math.min(p.y, q.y);
  const bottom = Math.max(p.y, q.y);
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

export function polygonArea(poly: Pt[]): number {
  let twice = 0;
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length];
    twice += p.x * q.y - q.x * p.y;
  });
  return Math.abs(twice) / 2;
}

/** The part of `poly` on one side of the line through a and b (Sutherland–Hodgman). */
function clipToSide(poly: Pt[], a: Pt, b: Pt, sign: 1 | -1): Pt[] {
  const side = (p: Pt) => sign * ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x));
  const out: Pt[] = [];
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length];
    const sp = side(p);
    const sq = side(q);
    if (sp >= 0) out.push(p);
    if ((sp >= 0) !== (sq >= 0)) {
      const t = sp / (sp - sq);
      out.push({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) });
    }
  });
  return out;
}

/** The image rectangle cut in two along the line through a and b, or null if it misses. */
export function splitByLine(width: number, height: number, a: Pt, b: Pt): [Pt[], Pt[]] | null {
  if (a.x === b.x && a.y === b.y) return null;
  const rect = rectPolygon({ x: 0, y: 0 }, { x: width, y: height });
  const halves: [Pt[], Pt[]] = [clipToSide(rect, a, b, 1), clipToSide(rect, a, b, -1)];
  return halves.every((h) => h.length >= 3 && polygonArea(h) >= MIN_PIECE * MIN_PIECE) ? halves : null;
}

/** Whole-pixel box of `poly` inside the image, or null when nothing worth cutting is left. */
export function cropBox(poly: Pt[], width: number, height: number): Box | null {
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  const left = Math.max(0, Math.floor(Math.min(...xs)));
  const top = Math.max(0, Math.floor(Math.min(...ys)));
  const right = Math.min(width, Math.ceil(Math.max(...xs)));
  const bottom = Math.min(height, Math.ceil(Math.max(...ys)));
  if (right - left < MIN_PIECE || bottom - top < MIN_PIECE) return null;
  return { left, top, width: right - left, height: bottom - top };
}
