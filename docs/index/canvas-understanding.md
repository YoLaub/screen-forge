---
id: okf-007
feature: canvas-understanding
branch: feature/canvas-understanding
status: done
files:
  - crates/sf-core/src/node.rs (Frame kind, position, parent)
  - crates/sf-core/src/store.rs (node_children in reading order)
  - crates/sf-core/src/project.rs (canvas.png)
  - crates/sf-mcp/src/tools.rs, server.rs (screens, canvas image, frame children)
  - src-tauri/src/project.rs (save_canvas takes the canvas render)
  - src/canvas/layout.ts (parents, descendants, render framing)
  - src/canvas/CanvasView.tsx (frames, labels, frame drag, renders, load guard)
tests:
  - crates/sf-core (node, store, project), crates/sf-mcp (tools, server), src-tauri/src/project.rs
  - src/canvas/layout.test.ts, nodeRecord.test.ts, autosave.test.ts
decisions:
  - "2026-09-24: grouping is a Frame node; membership comes from geometry (smallest larger frame containing the center), recomputed on every save"
  - "2026-09-24: dragging a frame drags its descendants, like Figma"
  - "2026-09-24: the agent gets a whole-canvas image and one whole-screen image per frame, at most 2000 px a side"
  - "2026-09-24: frames export no SVG (it would embed every capture as base64)"
  - "2026-09-24: autosave is blocked after a failed load (a save mirrors the canvas and would wipe the project)"
---

**What**: the agent sees the layout, not just a list: node positions, frames
(screens) with their elements in reading order, a canvas image and screen
images. Verified by the owner in the dev app; then `claude -p` +
`screenforge-mcp` described the login screen, its element order and offsets.

**Pitfalls**:
- The MCP E2E first ran a stale `screenforge-mcp` binary: `cargo test` does not
  rebuild `[[bin]]` targets. `cargo build -p sf-mcp` before any MCP E2E.
- Screenshots read back through the image viewer are downscaled: measure pixels
  in the page, never from the displayed image.
