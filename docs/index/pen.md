---
id: okf-011
feature: pen
branch: feature/pen
status: done
files:
  - src/canvas/penPath.ts (anchors, SVG path data, hit tests, anchor and handle moves)
  - src/canvas/tools.ts (pen tool, P key)
  - src/canvas/nodeRecord.ts (sfAnchors, sfClosed)
  - src/canvas/CanvasView.tsx (pen drawing, path editing)
tests:
  - src/canvas/penPath.test.ts, src/canvas/tools.test.ts
decisions:
  - "2026-09-24: Figma/Illustrator conventions: click = corner, drag = smooth point, click the first point to close, Enter/Escape to end open, Backspace drops the last point"
  - "2026-09-24: P is the pen; the polygon keeps its button without a key"
  - "2026-09-24: points are stored with the node (sfAnchors, path coordinates) and projected through the object's transform when editing"
  - "2026-09-24: editing rebuilds the path in scene coordinates, which resets its scale and rotation (stroke stays uniform)"
---

**What**: a pen tool drawing Bézier paths, and double-click editing of their
points and handles (Alt for one handle alone). Verified by the owner in the dev
app; then `claude -p` + `screenforge-mcp` described both paths (points, curves,
overall shape).

**Pitfalls**:
- A moved or scaled path keeps its original path data: project stored points
  with `calcTransformMatrix()` after subtracting `pathOffset`.
- The dev app window did not pick up the change through hot reload: restart
  `pnpm tauri dev` before asking the owner to test a front change.
