---
id: okf-005
feature: annotations-links
branch: feature/annotations-links
status: done
files:
  - src/canvas/NodeInspector.tsx (side inspector)
  - src/canvas/links.ts (link helpers, sf-core connections)
  - src/canvas/geometry.ts (edge-to-edge arrows)
  - src/canvas/nodeRecord.ts (sfLinks prop)
  - src/canvas/CanvasView.tsx (selection, arrows, link pruning)
tests:
  - src/canvas/NodeInspector.test.tsx
  - src/canvas/links.test.ts, src/canvas/geometry.test.ts, src/canvas/nodeRecord.test.ts
decisions:
  - "2026-09-23: selecting one node opens a side inspector (name, instructions, links) rather than notes on the canvas"
  - "2026-09-23: links live on the source node (sfLinks) and map to node.json connections; no format change for sf-core or the MCP"
  - "2026-09-23: arrows are display only (excludeFromExport), rebuilt from sfLinks; only node events trigger autosave"
  - "2026-09-23: deleting a node prunes links that pointed to it"
---

**What**: annotate a node with instructions for the agent and link it to other
nodes with a trigger and payload type. Verified in the real app by the owner,
then `claude -p` + `screenforge-mcp` found the annotated node, its instruction
and its `onSubmit` link.

**Pitfalls**:
- A flex item never shrinks below its content: the fixed-size `<canvas>` kept
  its area at full width and pushed the inspector off screen. Focusing an
  inspector field then scrolled `<main>` (even with `overflow-hidden`) by the
  inspector width, so canvas clicks missed their target. Fix: `min-w-0`.
