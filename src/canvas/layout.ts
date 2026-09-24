import type { Box } from "./geometry";
import type { NodeKind } from "./nodeRecord";

export interface LayoutItem {
  id: string;
  kind: NodeKind;
  bounds: Box;
}

const area = (b: Box) => b.width * b.height;

function containsPoint(b: Box, x: number, y: number): boolean {
  return x >= b.left && x <= b.left + b.width && y >= b.top && y <= b.top + b.height;
}

/**
 * Parent frame of every item: the smallest frame, larger than the item, that
 * contains the item's center. Undefined for top-level items.
 */
export function assignParents(items: LayoutItem[]): Record<string, string | undefined> {
  const frames = items.filter((i) => i.kind === "frame");
  const parents: Record<string, string | undefined> = {};
  for (const item of items) {
    const cx = item.bounds.left + item.bounds.width / 2;
    const cy = item.bounds.top + item.bounds.height / 2;
    const containing = frames
      .filter((f) => f.id !== item.id && area(f.bounds) > area(item.bounds))
      .filter((f) => containsPoint(f.bounds, cx, cy))
      .sort((a, b) => area(a.bounds) - area(b.bounds));
    parents[item.id] = containing[0]?.id;
  }
  return parents;
}

/** Smallest box around all `boxes`, grown by `margin` on each side. */
export function unionBox(boxes: Box[], margin: number): Box | null {
  if (boxes.length === 0) return null;
  const left = Math.min(...boxes.map((b) => b.left)) - margin;
  const top = Math.min(...boxes.map((b) => b.top)) - margin;
  const right = Math.max(...boxes.map((b) => b.left + b.width)) + margin;
  const bottom = Math.max(...boxes.map((b) => b.top + b.height)) + margin;
  return { left, top, width: right - left, height: bottom - top };
}

/** Scale that fits `box` within `maxSide` pixels, never enlarging it. */
export function renderScale(box: Box, maxSide: number): number {
  return Math.min(1, maxSide / Math.max(box.width, box.height));
}
