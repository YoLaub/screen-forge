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
  return nodes.map((n) => ({
    ...nodePropsOf(n),
    sfId: ids.get(n.sfId)!,
    sfName: `${n.sfName} copy`,
    sfLinks: (n.sfLinks ?? []).map((link) => ({ ...link, target_node: ids.get(link.target_node) ?? link.target_node })),
  }));
}
