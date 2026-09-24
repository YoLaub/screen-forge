---
id: okf-009
feature: shapes-text
branch: feature/shapes-text
status: done
files:
  - crates/sf-core/src/node.rs (text field)
  - src/canvas/tools.ts (keys, drag box, 45° snap, polygon points, names)
  - src/canvas/nodeRecord.ts (name prefix, text export)
  - src/canvas/CanvasView.tsx (toolbar, drawing, text editing)
tests:
  - crates/sf-core/src/node.rs
  - src/canvas/tools.test.ts, src/canvas/nodeRecord.test.ts
decisions:
  - "2026-09-24: an active tool draws by dragging (Figma-like), then falls back to Select; a click places a default size"
  - "2026-09-24: Frame became a drawing tool too (key F)"
  - "2026-09-24: every shape is a vector_drawing node named after its shape; text content is exported in node.json `text`"
  - "2026-09-24: neutral wireframe style until the styles feature"
---

**What**: toolbar and keys (V F R O L P T, Esc) to draw frames, rectangles,
ellipses, lines, polygons and text. Verified by the owner in the dev app; then
`claude -p` + `screenforge-mcp` listed the drawn text and told it apart from
node notes.

**Pitfalls**:
- The preview shape is rebuilt on every mouse move and is not a node, so it
  never triggers a save; the node is tagged on mouse up.
- A server built before a new node field ignores that field silently (serde
  drops unknown fields): rebuild the bundle (`pnpm bundle`) before relying on
  the registered server.
