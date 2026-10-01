import type { LayerItem } from "./layers";

/** Id of a new group, in sf-core's id alphabet. */
export function newGroupId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `grp_${Array.from(bytes, (b) => (b % 36).toString(36)).join("")}`;
}

/** `selected` plus the other members of every group it touches. */
export function expandToGroups(selected: string[], nodes: { id: string; group?: string }[]): string[] {
  const groups = new Set(nodes.filter((n) => selected.includes(n.id) && n.group).map((n) => n.group));
  const members = nodes.filter((n) => n.group && groups.has(n.group)).map((n) => n.id);
  return [...new Set([...selected, ...members])];
}

/**
 * Layer items (bottom to top) with a row per group: placed where its topmost
 * member is, its members nested under it. Members in another frame than the
 * topmost one stay under their frame.
 */
export function withGroupRows(items: LayerItem[]): LayerItem[] {
  const topmost = new Map<string, LayerItem>();
  for (const item of items) if (item.group) topmost.set(item.group.id, item);
  const members = (id: string) => items.filter((i) => i.group?.id === id);
  const rows: LayerItem[] = [];
  for (const item of items) {
    const group = item.group;
    const top = group && topmost.get(group.id);
    rows.push(group && top!.parent === item.parent ? { ...item, parent: group.id } : item);
    if (group && top === item) {
      rows.push({
        id: group.id,
        name: group.name,
        kind: "group",
        icon: "group",
        parent: item.parent,
        hidden: members(group.id).every((m) => m.hidden),
        locked: members(group.id).every((m) => m.locked),
      });
    }
  }
  return rows;
}
