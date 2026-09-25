---
id: okf-016
feature: export-png
branch: feature/export-png
status: done
files:
  - src/canvas/exportImage.ts (what to export, default file name)
  - src/canvas/CanvasView.tsx (Export button, rendering)
  - src/services/backend.ts (save dialog, export_png)
  - src-tauri/src/project.rs (export_png command)
  - src-tauri/capabilities/default.json (dialog:allow-save)
tests:
  - src/canvas/exportImage.test.ts, src-tauri/src/project.rs
decisions:
  - "2026-09-26: one Export button whose scope follows the selection: nothing = whole canvas, a frame = the frame with its content, one element = that element alone, several = the region they cover"
  - "2026-09-26: PNG only, through the macOS Save dialog; rendered at 2x (longest side capped at 8000 px), captures at native resolution"
  - "2026-09-26: the canvas export keeps frame names and link arrows, like the canvas.png the agent reads"
---

**What**: export a PNG of the canvas, a frame or an element. Verified in the
browser E2E (stubbed dialog and command): labels follow the selection, each
scope renders the expected image at 2x. Verified by the owner in the dev app: real macOS Save
dialog and file written.
