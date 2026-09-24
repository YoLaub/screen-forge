import type { NodeRecord } from "./nodeRecord";

/** A link as edited in the inspector: empty strings mean "not set". */
export interface Link {
  target_node: string;
  trigger: string;
  payload_type: string;
}

export function addLink(links: Link[], target: string): Link[] {
  return [...links, { target_node: target, trigger: "", payload_type: "" }];
}

export function updateLink(links: Link[], index: number, patch: Partial<Link>): Link[] {
  return links.map((link, i) => (i === index ? { ...link, ...patch } : link));
}

export function removeLink(links: Link[], index: number): Link[] {
  return links.filter((_, i) => i !== index);
}

export function pruneLinks(links: Link[], existingIds: Set<string>): Link[] {
  return links.filter((link) => existingIds.has(link.target_node));
}

export function toConnections(links: Link[]): NodeRecord["connections"] {
  return links.map(({ target_node, trigger, payload_type }) => ({
    target_node,
    ...(trigger.trim() && { trigger: trigger.trim() }),
    ...(payload_type.trim() && { payload_type: payload_type.trim() }),
  }));
}
