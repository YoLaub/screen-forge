export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Pt {
  x: number;
  y: number;
}

function center(b: Box): Pt {
  return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;
}

/** Fraction of the center-to-center vector that stays inside `b`. */
function exitFraction(b: Box, dx: number, dy: number): number {
  const tx = dx === 0 ? Infinity : b.width / 2 / Math.abs(dx);
  const ty = dy === 0 ? Infinity : b.height / 2 / Math.abs(dy);
  return Math.min(tx, ty);
}

/** Arrow from the edge of `a` to the edge of `b`, along the line joining their centers. */
export function arrowBetween(a: Box, b: Box): { from: Pt; to: Pt } | null {
  if (overlaps(a, b)) return null;
  const ca = center(a);
  const cb = center(b);
  const dx = cb.x - ca.x;
  const dy = cb.y - ca.y;
  const ta = exitFraction(a, dx, dy);
  const tb = exitFraction(b, dx, dy);
  return {
    from: { x: ca.x + dx * ta, y: ca.y + dy * ta },
    to: { x: cb.x - dx * tb, y: cb.y - dy * tb },
  };
}

/** The two barb ends of an arrowhead at `to`, 30° either side of the shaft. */
export function arrowHead(from: Pt, to: Pt, size: number): [Pt, Pt] {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const barb = (offset: number): Pt => ({
    x: to.x - size * Math.cos(angle + offset),
    y: to.y - size * Math.sin(angle + offset),
  });
  return [barb(-Math.PI / 6), barb(Math.PI / 6)];
}
