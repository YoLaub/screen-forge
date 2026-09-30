---
id: okf-019
feature: context-menu
branch: feature/context-menu
status: done
files:
  - src/canvas/contextMenu.ts (menu items and their state, paste placement)
  - src/canvas/CanvasView.tsx (Radix context menu, copy/paste, lock, restack targets)
  - package.json (@radix-ui/react-context-menu, MIT)
tests:
  - src/canvas/contextMenu.test.ts, src/canvas/duplicate.test.ts
decisions:
  - "2026-09-30: right-click acts on the selection when it is clicked, else on the node under the pointer, locked ones included so they can be unlocked; on empty canvas only Paste is offered"
  - "2026-09-30: copy/paste is internal (a snapshot of the nodes, pasted with fresh ids and unlocked); an image on the system clipboard still pastes as a capture"
  - "2026-09-30: menu Paste centers on the right-click point; Cmd+V pastes 20 px further per successive paste"
  - "2026-09-30: Group and Merge are added to this menu by their own features"
---

**What**: a right-click menu (Copy, Paste, Duplicate, Lock/Unlock, Bring
forward, Send backward) and Cmd+C / Cmd+V for nodes. Verified in the browser
E2E: item states per context, paste at the click point, unlock from the menu,
keyboard copy and paste, clean console.

**Pitfalls**:
- Fabric's `stopContextMenu` defaults to true and stops the event at the canvas,
  so the Radix trigger never saw right-clicks: set it to false.
