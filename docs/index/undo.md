---
id: okf-013
feature: undo
branch: feature/undo
status: done
files:
  - src/canvas/history.ts (snapshot history)
  - src/canvas/CanvasView.tsx (commit, restore, Cmd+Z / Cmd+Shift+Z)
tests:
  - src/canvas/history.test.ts
decisions:
  - "2026-09-24: undo by whole-canvas snapshots, so every action is covered without per-action code"
  - "2026-09-24: snapshots are grouped over 300 ms (a drag is one step), at most 100, kept in memory for the session"
  - "2026-09-24: a restored state is saved to disk so the agent sees it"
---

**What**: Cmd+Z and Cmd+Shift+Z undo and redo every canvas change (shapes,
moves, styles, links, layers, booleans). Verified by the browser E2E and by
the owner in the dev app.

**Pitfalls**:
- Restoring reloads the canvas, which fires `object:added` for every node: the
  change handler must ignore them (`restoring`), or the restore records itself.
