---
id: okf-021
feature: flatten
branch: feature/flatten
status: done
files:
  - src/canvas/flatten.ts (render scale, merged instructions and links)
  - src/canvas/contextMenu.ts (Merge layers)
  - src/canvas/CanvasView.tsx (flatten, Cmd+E)
tests:
  - src/canvas/flatten.test.ts, src/canvas/contextMenu.test.ts
decisions:
  - "2026-09-30: Merge layers flattens 2+ nodes into one capture named 'Merged N', like an image editor; the sources are removed (Cmd+Z restores them)"
  - "2026-09-30: rendered alone on a transparent background, at the finest capture resolution in the merge (at least 2x, longest side capped at 8000 px)"
  - "2026-09-30: the capture keeps each source's instructions as '<name>: <text>' lines and the links going out of the merged set; links to a source now point at the capture"
---

**What**: merge the selection into one capture (right-click menu or Cmd+E).
Verified in the browser E2E: a capture at 50% plus a highlight merge into an
800x400 image identical on screen, instructions kept, an incoming link
redirected, empty areas transparent.
