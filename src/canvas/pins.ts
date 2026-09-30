import type { Box, Pt } from "./geometry";
import type { LayerItem } from "./layers";

/**
 * Pin number of each element with instructions, in layers order (top to bottom).
 * Uses the rows' `instructed` flag, i.e. the same `hasInstructions` rule as the
 * layer dots and the coverage footer. Hidden elements are not sent to the agent.
 */
export function pinNumbers(rows: LayerItem[]): Map<string, number> {
  const numbered = rows.filter((r) => r.kind !== "group" && r.instructed && !r.hidden);
  return new Map(numbered.map((r, i) => [r.id, i + 1]));
}

/** Screen position of a pin (top-right corner of the element) and of its hover callout. */
export function pinPlacement(box: Box): { pin: Pt; callout: Pt } {
  const right = box.left + box.width;
  return { pin: { x: right - 10, y: box.top - 10 }, callout: { x: right + 16, y: box.top - 12 } };
}
