import type { Box } from "./geometry";
import { type Link, toConnections } from "./links";
import type { Anchor } from "./penPath";
import { type NodeStyle, colorsOf } from "./style";

/** Node metadata in the sf-core `node.json` shape (spec §7). */
export type NodeKind = "capture" | "vector_drawing" | "frame";

export interface NodeRecord {
  id: string;
  type: NodeKind;
  name: string;
  dimensions: { width: number; height: number };
  position?: { x: number; y: number };
  parent?: string;
  text?: string;
  style?: NodeStyle;
  colors_detected: string[];
  connections: { target_node: string; trigger?: string; payload_type?: string }[];
  user_instructions: string;
}

/** ScreenForge properties carried by every Fabric object that is a node. */
export interface SfProps {
  sfId: string;
  sfKind: NodeKind;
  sfName: string;
  sfInstructions: string;
  /** Outgoing links. Absent on canvases saved before links existed. */
  sfLinks?: Link[];
  /** Pen paths: their points (in path coordinates) and whether they are closed. */
  sfAnchors?: Anchor[];
  sfClosed?: boolean;
  /** Locked in the layers panel: not selectable or movable on the canvas. */
  sfLocked?: boolean;
  /** Stroke-only shapes drawn as a path (no fill, not combinable). */
  sfShape?: "arrow" | "cross";
}

/** Serialized with the canvas (see FabricObject.customProperties). */
export const SF_PROPS: (keyof SfProps)[] = [
  "sfId",
  "sfKind",
  "sfName",
  "sfInstructions",
  "sfLinks",
  "sfAnchors",
  "sfClosed",
  "sfLocked",
  "sfShape",
];

const ID_PREFIX: Record<NodeKind, string> = { capture: "cap", vector_drawing: "vec", frame: "frm" };
const NAME_PREFIX: Record<NodeKind, string> = {
  capture: "Capture",
  vector_drawing: "Rectangle",
  frame: "Frame",
};

/** Matches sf-core's id rule: [A-Za-z0-9_-]. */
export function newNodeId(kind: NodeKind): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const suffix = Array.from(bytes, (b) => (b % 36).toString(36)).join("");
  return `${ID_PREFIX[kind]}_${suffix}`;
}

/** Next free "<prefix> N" name; the prefix defaults to the kind's (e.g. "Capture"). */
export function nextNodeName(kind: NodeKind, existing: string[], prefix = NAME_PREFIX[kind]): string {
  const pattern = new RegExp(`^${prefix} (\\d+)$`);
  const highest = existing.reduce((max, name) => {
    const n = Number(pattern.exec(name)?.[1] ?? 0);
    return Math.max(max, n);
  }, 0);
  return `${prefix} ${highest + 1}`;
}

export interface RecordExtras {
  /** Scene bounds: gives the position. */
  bounds?: Box;
  /** Id of the containing frame. */
  parent?: string;
  /** Content of a text element. */
  text?: string;
  style?: NodeStyle;
  /** Links to export instead of the stored ones (e.g. without hidden targets). */
  links?: Link[];
}

export function toNodeRecord(
  obj: SfProps & { width: number; height: number; scaleX: number; scaleY: number },
  { bounds, parent, text, style, links }: RecordExtras = {},
): NodeRecord {
  return {
    id: obj.sfId,
    type: obj.sfKind,
    name: obj.sfName,
    dimensions: {
      width: Math.round(obj.width * obj.scaleX),
      height: Math.round(obj.height * obj.scaleY),
    },
    ...(bounds && { position: { x: Math.round(bounds.left), y: Math.round(bounds.top) } }),
    ...(parent && { parent }),
    ...(text !== undefined && { text }),
    ...(style && Object.keys(style).length > 0 && { style }),
    colors_detected: style ? colorsOf(style) : [],
    connections: toConnections(links ?? obj.sfLinks ?? []),
    user_instructions: obj.sfInstructions,
  };
}
