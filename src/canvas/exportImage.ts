import type { NodeKind } from "./nodeRecord";

/** What the Export button renders: everything, a frame with its content, one node, or a multi-selection's region. */
export type ExportScope = "canvas" | "frame" | "node" | "region";

export interface ExportTarget {
  scope: ExportScope;
  label: string;
  fileName: string;
}

/** `<name>.png`, with the separators macOS or Finder reject replaced by " - ". */
export function exportFileName(name: string): string {
  const safe = name
    .replace(/\s*[/:\\]+\s*/g, " - ")
    .replace(/[\u0000-\u001f]/g, "")
    .trim();
  return `${safe || "export"}.png`;
}

export function exportTarget(selection: { kind: NodeKind; name: string }[], project: string): ExportTarget {
  if (selection.length === 0) return { scope: "canvas", label: "Export canvas", fileName: exportFileName(project) };
  if (selection.length > 1) return { scope: "region", label: "Export selection", fileName: "selection.png" };
  const [only] = selection;
  return only.kind === "frame"
    ? { scope: "frame", label: "Export frame", fileName: exportFileName(only.name) }
    : { scope: "node", label: "Export element", fileName: exportFileName(only.name) };
}
