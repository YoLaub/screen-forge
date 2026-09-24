---
id: okf-004
feature: canvas
branch: feature/canvas
status: done
files:
  - crates/sf-core/src/project.rs (save_project, load_canvas)
  - src-tauri/src/project.rs (save/load/last-project commands)
  - src/App.tsx (open-folder flow)
  - src/canvas/CanvasView.tsx (Fabric wiring)
  - src/canvas/{viewport,nodeRecord,autosave,exportNode,imageFile}.ts (pure helpers)
  - src/services/backend.ts (Tauri invoke wrappers)
tests:
  - crates/sf-core/src/project.rs
  - src-tauri/src/project.rs
  - src/App.test.tsx, src/canvas/*.test.ts
decisions:
  - "2026-09-23: project folder picked in a native dialog and remembered in the app config dir (works when launched from the Dock)"
  - "2026-09-23: autosave 500 ms after the last change, saves never overlap (the MCP always sees current state)"
  - "2026-09-23: a save mirrors the canvas and deletes folders of removed nodes (no ghost nodes for the agent)"
  - "2026-09-23: captures get no export.svg (it would only wrap the PNG); their PNG is exported at native resolution"
  - "2026-09-23: trackpad navigation like Figma: two-finger scroll pans, pinch or Cmd+wheel zooms"
  - "2026-09-23: paste (Cmd+V) and drop share one capture path; Tauri dragDropEnabled is false on the main window"
---

**What**: open a project folder, draw rectangles, paste or drop screenshots as
capture nodes, delete with Backspace, autosave into `.screenforge/`. Verified in
the real app by the owner, then `claude -p` + `screenforge-mcp` described the
pasted screenshot from the app-written folder.

**Pitfalls**:
- Fabric 7 positions objects by their center (`originX/Y` default `center`).
- Tauri swallows file drops unless `dragDropEnabled: false` on the window.
- pnpm 11 fails `install --frozen-lockfile` until `allowBuilds` decides on
  Fabric's optional `canvas` dependency.
- Testing Library only auto-cleans with Vitest globals on: `afterEach(cleanup)`.
