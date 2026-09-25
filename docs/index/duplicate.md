---
id: okf-015
feature: duplicate
branch: feature/duplicate
status: done
files:
  - src/canvas/duplicate.ts (copy props: new ids, names, remapped links)
  - src/canvas/CanvasView.tsx (Cmd+D)
tests:
  - src/canvas/duplicate.test.ts
decisions:
  - "2026-09-26: Cmd+D duplicates any selection (one or several nodes), 20 px right and down, each copy right above its original"
  - "2026-09-26: copies are named '<name> copy' and keep instructions and links; a link between two duplicated nodes points at the copies"
  - "2026-09-26: a frame is duplicated alone, like any node; its content is copied only if it is selected too"
---

**What**: duplicate the selection with Cmd+D. Verified in the browser E2E: one
node, then three at once, new ids and offset positions in the save, one Cmd+Z
undoes the whole duplication.
