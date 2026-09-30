import type { GroupRef, NodeKind } from "./nodeRecord";

/** A node as the layers panel sees it. */
export interface LayerItem {
  id: string;
  name: string;
  /** A group row stands for its members. */
  kind: NodeKind | "group";
  /** Id of the containing frame or group row. */
  parent?: string;
  group?: GroupRef;
  /** Which icon the row shows (see layerIcon). */
  icon?: LayerIcon;
  /** The element has instructions for the agent. */
  instructed?: boolean;
  hidden: boolean;
  locked: boolean;
}

export interface LayerRow {
  item: LayerItem;
  /** Nesting level: 0 at the top, +1 per containing frame. */
  depth: number;
}

/**
 * Rows of the layers panel from `items` given bottom to top (canvas order):
 * top of the stack first, each frame followed by its content.
 */
export function layerRows(items: LayerItem[]): LayerRow[] {
  const topFirst = [...items].reverse();
  const rows: LayerRow[] = [];
  const add = (parent: string | undefined, depth: number) => {
    for (const item of topFirst.filter((i) => i.parent === parent)) {
      rows.push({ item, depth });
      add(item.id, depth + 1);
    }
  };
  add(undefined, 0);
  return rows;
}

/** Fabric properties of a locked (or unlocked) element. */
export function lockProps(locked: boolean) {
  return {
    selectable: !locked,
    evented: !locked,
    lockMovementX: locked,
    lockMovementY: locked,
    lockScalingX: locked,
    lockScalingY: locked,
    lockRotation: locked,
  };
}

export type LayerIcon =
  | "frame" | "capture" | "rect" | "ellipse" | "polygon" | "line" | "arrow" | "cross" | "path" | "text" | "group";

const SHAPE_ICONS: Record<string, LayerIcon> = {
  rect: "rect", ellipse: "ellipse", polygon: "polygon", line: "line", itext: "text", textbox: "text", path: "path",
};

/** Icon of a layer row from its node kind, Fabric type and ScreenForge shape marker. */
export function layerIcon(o: { kind: NodeKind | "group"; type?: string; shape?: "arrow" | "cross" }): LayerIcon {
  if (o.kind === "frame" || o.kind === "capture" || o.kind === "group") return o.kind;
  if (o.shape) return o.shape;
  return SHAPE_ICONS[(o.type ?? "").toLowerCase().replace(/[^a-z]/g, "")] ?? "path";
}

/**
 * Whether an element has instructions for the agent. The one rule behind the
 * layer dots, the coverage count and the canvas pins: they must always agree.
 */
export function hasInstructions(text: string | undefined): boolean {
  return (text ?? "").trim() !== "";
}

/** "covered of total elements have instructions"; group rows are not elements. */
export function instructionCoverage(items: LayerItem[]): { covered: number; total: number } {
  const elements = items.filter((i) => i.kind !== "group");
  return { covered: elements.filter((i) => i.instructed).length, total: elements.length };
}

/** Below this window width the layers panel floats over the canvas (mockup 1d). */
export const LAYERS_DOCKED_MIN_WIDTH = 1200;

export function layersLayout(windowWidth: number): "docked" | "floating" {
  return windowWidth >= LAYERS_DOCKED_MIN_WIDTH ? "docked" : "floating";
}
