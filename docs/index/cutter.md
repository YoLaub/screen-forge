---
id: okf-017
feature: cutter
branch: feature/cutter
status: done
files:
  - src/canvas/cut.ts (scene to image pixels, box and line geometry)
  - src/canvas/tools.ts (cut tool, C key, cut modes)
  - src/canvas/CanvasView.tsx (gestures, pixel cutting, mode picker)
tests:
  - src/canvas/cut.test.ts, src/canvas/tools.test.ts
decisions:
  - "2026-09-26: the cutter works on captures only (bitmaps); vector shapes keep the boolean operations"
  - "2026-09-26: three modes: freehand lasso, rectangle, straight line; lasso and rectangle cut a piece out and leave a transparent hole, the line splits the capture in two"
  - "2026-09-26: the gesture cuts the topmost visible, unlocked capture it reaches; the piece is placed exactly where it was cut and selected, ready to move"
  - "2026-09-26: the cut capture keeps its id, name, notes and links; new pieces are captures named '<name> cut N'"
---

**What**: cut part of a capture out to move it. Verified in the browser E2E on
an 800x400 capture scaled to 50%: lasso, rectangle and line cuts, pieces aligned
with the original before moving, Cmd+Z undoes a cut.

**Pitfalls**:
- In dev, React StrictMode mounts the canvas twice: the first, disposed canvas
  can fail its async load and show "Load failed" in the status line although
  the live canvas works. Not specific to the cutter.
