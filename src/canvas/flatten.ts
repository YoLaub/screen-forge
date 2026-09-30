import type { Box } from "./geometry";
import type { SfProps } from "./nodeRecord";

/** Longest side of a merged image, in pixels. */
const FLATTEN_MAX_SIDE = 8000;

/**
 * Render scale of a merge: the finest resolution among its captures (a capture
 * shown at `scale` has 1/scale pixels per scene unit), at least 2x, capped.
 */
export function flattenScale(box: Box, captureScales: number[]): number {
  const finest = Math.max(2, ...captureScales.map((s) => 1 / s));
  return Math.min(finest, FLATTEN_MAX_SIDE / Math.max(box.width, box.height));
}

/** Instructions and links the merged node keeps from its sources (bottom to top). */
export function mergedNodeProps(sources: SfProps[]): Pick<SfProps, "sfInstructions" | "sfLinks"> {
  const ids = new Set(sources.map((s) => s.sfId));
  const seen = new Set<string>();
  const links = sources
    .flatMap((s) => s.sfLinks ?? [])
    .filter((l) => !ids.has(l.target_node) && !seen.has(l.target_node) && seen.add(l.target_node));
  const instructions = sources
    .filter((s) => s.sfInstructions.trim() !== "")
    .map((s) => `${s.sfName}: ${s.sfInstructions.trim()}`)
    .join("\n");
  return { sfInstructions: instructions, sfLinks: links };
}
