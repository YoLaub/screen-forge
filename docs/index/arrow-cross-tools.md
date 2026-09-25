---
id: okf-014
feature: arrow-cross-tools
branch: feature/arrow-cross-tools
status: done
files:
  - src/canvas/tools.ts (arrow and cross tools, A and X keys, arrowPath, crossPath)
  - src/canvas/nodeRecord.ts (sfShape)
  - src/canvas/CanvasView.tsx (toolbar buttons, shapes)
tests:
  - src/canvas/tools.test.ts
decisions:
  - "2026-09-26: arrow and cross are stroke-only Fabric paths marked with sfShape: no Fill control, excluded from boolean operations"
  - "2026-09-26: arrow drags from tail to tip, Shift snaps to 45° like the line; cross is drawn in the dragged box, Shift keeps it square, red by default"
  - "2026-09-26: the arrow head grows with the stroke (10 + 3 x width); changing the width redraws the arrow between the same ends, resetting its scale and rotation like a path edit"
  - "2026-09-26: bare X is the cross; Cmd+Shift+X stays the global capture shortcut"
---

**What**: two annotation tools, Arrow (A) and Cross (X). Verified in the browser
E2E (Vite + stubbed Tauri invoke): both drawn by drag and by click, saved as
nodes with an SVG export and `sfShape` kept in `canvas.json`.
