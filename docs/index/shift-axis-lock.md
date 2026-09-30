---
id: okf-018
feature: shift-axis-lock
branch: feature/shift-axis-lock
status: done
files:
  - src/canvas/geometry.ts (lockToAxis)
  - src/canvas/CanvasView.tsx (object:moving handler)
tests:
  - src/canvas/geometry.test.ts
decisions:
  - "2026-09-30: Shift while moving keeps the move on the axis it went furthest on, measured from where the drag started; it can be pressed before or during the drag"
  - "2026-09-30: the lock runs before the other move handlers, so a frame's content and the link arrows follow the locked position"
---

**What**: Shift constrains a move to horizontal or vertical. Verified in the
browser E2E: Shift pressed mid-drag and before the click, and a frame dragged
with Shift carries its content on the same axis.
