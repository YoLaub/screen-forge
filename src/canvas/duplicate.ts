import { newGroupId } from "./groups";
import { type NodeKind, SF_PROPS, type SfProps } from "./nodeRecord";

/** The ScreenForge props of `n` alone, even when `n` is a whole Fabric object or its JSON. */
function nodePropsOf(n: SfProps): SfProps {
  return Object.fromEntries(SF_PROPS.filter((key) => key in n).map((key) => [key, n[key]])) as unknown as SfProps;
}

/**
 * Node props for copies of `nodes`, in the same order: new ids, "<name> copy"
 * names, and links between duplicated nodes pointed at their copies.
 */
export function duplicateProps(nodes: SfProps[], newId: (kind: NodeKind) => string): SfProps[] {
  const ids = new Map(nodes.map((n) => [n.sfId, newId(n.sfKind)]));
  // Several copied members of a group make a new group; a lone one stays in its group.
  const counts = new Map<string, number>();
  nodes.forEach((n) => n.sfGroup && counts.set(n.sfGroup.id, (counts.get(n.sfGroup.id) ?? 0) + 1));
  const groups = new Map(
    nodes
      .filter((n) => n.sfGroup && counts.get(n.sfGroup.id)! > 1)
      .map((n) => [n.sfGroup!.id, { id: newGroupId(), name: `${n.sfGroup!.name} copy` }]),
  );
  return nodes.map((n) => ({
    ...nodePropsOf(n),
    sfId: ids.get(n.sfId)!,
    sfName: `${n.sfName} copy`,
    ...(n.sfGroup && { sfGroup: groups.get(n.sfGroup.id) ?? n.sfGroup }),
    sfLinks: (n.sfLinks ?? []).map((link) => ({ ...link, target_node: ids.get(link.target_node) ?? link.target_node })),
  }));
}
