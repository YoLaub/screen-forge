import { type Link, toConnections } from "./links";

/** Node metadata in the sf-core `node.json` shape (spec §7). */
export type NodeKind = "capture" | "vector_drawing";

export interface NodeRecord {
  id: string;
  type: NodeKind;
  name: string;
  dimensions: { width: number; height: number };
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
}

/** Serialized with the canvas (see FabricObject.customProperties). */
export const SF_PROPS: (keyof SfProps)[] = ["sfId", "sfKind", "sfName", "sfInstructions", "sfLinks"];

const ID_PREFIX: Record<NodeKind, string> = { capture: "cap", vector_drawing: "vec" };
const NAME_PREFIX: Record<NodeKind, string> = { capture: "Capture", vector_drawing: "Rectangle" };

/** Matches sf-core's id rule: [A-Za-z0-9_-]. */
export function newNodeId(kind: NodeKind): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const suffix = Array.from(bytes, (b) => (b % 36).toString(36)).join("");
  return `${ID_PREFIX[kind]}_${suffix}`;
}

export function nextNodeName(kind: NodeKind, existing: string[]): string {
  const prefix = NAME_PREFIX[kind];
  const pattern = new RegExp(`^${prefix} (\\d+)$`);
  const highest = existing.reduce((max, name) => {
    const n = Number(pattern.exec(name)?.[1] ?? 0);
    return Math.max(max, n);
  }, 0);
  return `${prefix} ${highest + 1}`;
}

export function toNodeRecord(
  obj: SfProps & { width: number; height: number; scaleX: number; scaleY: number },
): NodeRecord {
  return {
    id: obj.sfId,
    type: obj.sfKind,
    name: obj.sfName,
    dimensions: {
      width: Math.round(obj.width * obj.scaleX),
      height: Math.round(obj.height * obj.scaleY),
    },
    colors_detected: [],
    connections: toConnections(obj.sfLinks ?? []),
    user_instructions: obj.sfInstructions,
  };
}
