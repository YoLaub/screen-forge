import type { Box, Pt } from "./geometry";

export type Tool = "select" | "frame" | "rect" | "ellipse" | "line" | "polygon" | "pen" | "text";
export type DrawingTool = Exclude<Tool, "select">;

const TOOL_KEYS: Record<string, Tool> = {
  v: "select",
  f: "frame",
  r: "rect",
  o: "ellipse",
  l: "line",
  p: "pen",
  t: "text",
};

/** Default node name prefix per tool. */
export const SHAPE_NAMES: Record<DrawingTool, string> = {
  frame: "Frame",
  rect: "Rectangle",
  ellipse: "Ellipse",
  line: "Line",
  polygon: "Polygon",
  pen: "Path",
  text: "Text",
};

/** Tool for a bare letter key; shortcuts with a modifier (Cmd+V…) are not tools. */
export function toolForKey(e: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey">): Tool | undefined {
  if (e.metaKey || e.ctrlKey || e.altKey) return undefined;
  return TOOL_KEYS[e.key.toLowerCase()];
}

/** Box dragged from `start` to `end`, in any direction; `square` keeps equal sides. */
export function dragBox(start: Pt, end: Pt, square: boolean): Box {
  let dx = end.x - start.x;
  let dy = end.y - start.y;
  if (square) {
    const side = Math.max(Math.abs(dx), Math.abs(dy));
    dx = Math.sign(dx || 1) * side;
    dy = Math.sign(dy || 1) * side;
  }
  return {
    left: Math.min(start.x, start.x + dx),
    top: Math.min(start.y, start.y + dy),
    width: Math.abs(dx),
    height: Math.abs(dy),
  };
}

/** Line end, snapped to the nearest multiple of 45° when `snap` is set. */
export function snapLine(start: Pt, end: Pt, snap: boolean): Pt {
  if (!snap) return end;
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const step = Math.PI / 4;
  const angle = Math.round(Math.atan2(end.y - start.y, end.x - start.x) / step) * step;
  return { x: start.x + length * Math.cos(angle), y: start.y + length * Math.sin(angle) };
}

/** Vertices of a regular polygon inscribed in `box`, the first one at the top. */
export function polygonPoints(sides: number, box: Box): Pt[] {
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  return Array.from({ length: sides }, (_, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / sides;
    return { x: cx + (box.width / 2) * Math.cos(angle), y: cy + (box.height / 2) * Math.sin(angle) };
  });
}
