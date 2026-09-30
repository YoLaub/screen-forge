import { type Box, type Pt, arrowHead } from "./geometry";

export type Tool = "select" | "frame" | "rect" | "ellipse" | "line" | "arrow" | "cross" | "polygon" | "pen" | "text" | "cut";
/** Tools that draw a new node (the cutter reshapes captures instead). */
export type DrawingTool = Exclude<Tool, "select" | "cut">;

const TOOL_KEYS: Record<string, Tool> = {
  v: "select",
  f: "frame",
  r: "rect",
  o: "ellipse",
  l: "line",
  a: "arrow",
  x: "cross",
  c: "cut",
  p: "pen",
  t: "text",
};

/** Default node name prefix per tool. */
export const SHAPE_NAMES: Record<DrawingTool, string> = {
  frame: "Frame",
  rect: "Rectangle",
  ellipse: "Ellipse",
  line: "Line",
  arrow: "Arrow",
  cross: "Cross",
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

/** SVG path of an arrow from `start` to `end`: the shaft, then a barb, the tip and the other barb. */
export function arrowPath(start: Pt, end: Pt, headSize: number): string {
  const [b1, b2] = arrowHead(start, end, headSize);
  return `M ${start.x} ${start.y} L ${end.x} ${end.y} M ${b1.x} ${b1.y} L ${end.x} ${end.y} L ${b2.x} ${b2.y}`;
}

/** SVG path of an X joining the opposite corners of `box`. */
export function crossPath(box: Box): string {
  const right = box.left + box.width;
  const bottom = box.top + box.height;
  return `M ${box.left} ${box.top} L ${right} ${bottom} M ${right} ${box.top} L ${box.left} ${bottom}`;
}

/** Barb length of an arrow drawn with `strokeWidth`: proportional, so a thick stroke does not swallow the head. */
export function arrowHeadSize(strokeWidth: number): number {
  return 10 + 3 * strokeWidth;
}

/** How the cut tool draws the part to cut. */
export type CutMode = "lasso" | "line" | "rect" | "ellipse";

/** Tools sharing one toolbar button, with a flyout to pick among them. */
export const TOOL_GROUPS = {
  shape: ["rect", "ellipse", "polygon"],
  line: ["line", "arrow"],
} as const satisfies Record<string, readonly Tool[]>;

export type ToolGroup = keyof typeof TOOL_GROUPS;
export type GroupChoice = { [G in ToolGroup]: (typeof TOOL_GROUPS)[G][number] };

export function groupOf(tool: Tool): ToolGroup | undefined {
  return (Object.keys(TOOL_GROUPS) as ToolGroup[]).find((g) => (TOOL_GROUPS[g] as readonly Tool[]).includes(tool));
}

/** The tool each group button shows: the last one picked in that group. */
export function rememberInGroup(choice: GroupChoice, tool: Tool): GroupChoice {
  const group = groupOf(tool);
  return group ? { ...choice, [group]: tool } : choice;
}

/** Hint shown next to the cut modes (mockup wording; Ellipse came after the mockup). */
export const CUT_HINTS: Record<CutMode, string> = {
  lasso: "Circle an area of a capture",
  line: "Drag across a capture to split it",
  rect: "Drag a box over a capture",
  ellipse: "Drag to cut an ellipse · Shift for a circle",
};

/** Toolbar names, keys and hints ("" when a tool has no key). */
export const TOOL_META: Record<Tool, { label: string; key: string; hint: string }> = {
  select: { label: "Select", key: "V", hint: "Select and move (Shift keeps the move horizontal or vertical); ⌘D duplicates" },
  frame: { label: "Frame", key: "F", hint: "A named screen: everything placed inside it belongs to it" },
  rect: { label: "Rectangle", key: "R", hint: "Drag to draw; Shift for a square" },
  ellipse: { label: "Ellipse", key: "O", hint: "Drag to draw; Shift for a circle" },
  polygon: { label: "Polygon", key: "", hint: "Drag to draw" },
  line: { label: "Line", key: "L", hint: "Drag to draw; Shift snaps to 45°" },
  arrow: { label: "Arrow", key: "A", hint: "Drag from tail to tip; Shift snaps to 45°" },
  cross: { label: "Cross", key: "X", hint: "Drag to draw; Shift keeps it square" },
  pen: { label: "Pen", key: "P", hint: "Click for corners, drag for curves; click the first point to close, Enter to finish" },
  text: { label: "Text", key: "T", hint: "Click to type" },
  cut: { label: "Cut", key: "C", hint: "Cut a part out of a capture, then move it" },
};

/** "Rectangle (R)", or just "Polygon" for a tool without a key. */
export function toolTitle(tool: Tool): string {
  const { label, key } = TOOL_META[tool];
  return key ? `${label} (${key})` : label;
}
