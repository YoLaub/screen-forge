---
id: okf-010
feature: styles
branch: feature/styles
status: done
files:
  - crates/sf-core/src/node.rs (Style, Gradient)
  - src/canvas/style.ts (read, colors, hex, gradient angle, Fabric mapping)
  - src/canvas/StyleSection.tsx (inspector style controls)
  - src/canvas/NodeInspector.tsx, CanvasView.tsx (wiring)
  - src/canvas/nodeRecord.ts (named extras, style, colors_detected)
tests:
  - crates/sf-core/src/node.rs
  - src/canvas/style.test.ts, StyleSection.test.tsx, NodeInspector.test.tsx, nodeRecord.test.ts
decisions:
  - "2026-09-24: native macOS color well plus an exact hex field; opacity as a separate slider"
  - "2026-09-24: node.json gets a CSS-like `style` block and `colors_detected`, so the agent writes CSS without decoding the SVG"
  - "2026-09-24: gradients use percentage coordinates and CSS angles (90 = left to right), two stops"
  - "2026-09-24: captures have no style section (bitmaps)"
---

**What**: fill (solid, linear or radial gradient), stroke, corner radius,
opacity, font size and weight in the inspector, exported to the agent. Verified
by the owner in the dev app; then `claude -p` + `screenforge-mcp` produced
exact CSS (gradient, border, radius) for two elements.

**Pitfalls**:
- Fabric gives a Line a default black fill that is never drawn: the style
  reader must skip the fill where it does not apply.
- A controlled slider already at 100 emits no change event for 100: test the
  "back to 100" case from another value.
