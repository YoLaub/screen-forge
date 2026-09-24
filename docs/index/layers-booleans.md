---
id: okf-012
feature: layers-booleans
branch: feature/layers-booleans
status: done
files:
  - src/canvas/layers.ts (layer tree rows, lock properties)
  - src/canvas/LayersPanel.tsx (panel)
  - src/canvas/booleans.ts (Paper.js booleans, editable result)
  - src/canvas/nodeRecord.ts (sfLocked, links override)
  - src/canvas/CanvasView.tsx (hide, lock, restack, combine)
tests:
  - src/canvas/layers.test.ts, LayersPanel.test.tsx, booleans.test.ts, nodeRecord.test.ts
decisions:
  - "2026-09-24: layers as a tree (screens, then their elements), reordered with buttons and Cmd+[ / Cmd+], no drag and drop"
  - "2026-09-24: hidden nodes are neither drawn nor sent to the agent; links to them are dropped from the export"
  - "2026-09-24: booleans keep the originals, hidden (the app has no undo yet); the result takes the bottom shape's style; subtract removes the upper shapes from the bottom one"
  - "2026-09-24: shapes reach Paper.js as each object's own SVG, so transforms and curves need no custom conversion"
---

**What**: layers panel (select, rename, hide, lock, restack) and boolean
operations. Verified by the browser E2E and by the owner in the dev app.

**Pitfalls**:
- Paper.js creates a canvas when it loads: under jsdom, stub
  `HTMLCanvasElement.prototype.getContext` in `vi.hoisted` before the import.
- A compound result's signed areas cancel out: test emptiness with bounds, not
  `area`.
- Drawn shapes are added before they become nodes: whatever follows a node
  change (layers, arrows, save) must run where the node is tagged.
