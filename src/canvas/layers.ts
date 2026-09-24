import type { NodeKind } from "./nodeRecord";

/** A node as the layers panel sees it. */
export interface LayerItem {
  id: string;
  name: string;
  kind: NodeKind;
  /** Id of the containing frame. */
  parent?: string;
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
