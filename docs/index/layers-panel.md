---
id: okf-025
feature: layers-panel
branch: feature/layers-panel
status: done
issue: "#4 [RD-04]"
files:
  - src/canvas/LayersPanel.tsx (redesigned panel)
  - src/canvas/layers.ts (layerIcon, hasInstructions, instructionCoverage)
  - src/canvas/toolIcons.tsx (LAYER_ICONS)
  - src/canvas/CanvasView.tsx, src/canvas/groups.ts (icon and instruction flag per row)
tests:
  - src/canvas/layers.test.ts, src/canvas/LayersPanel.test.tsx
decisions:
  - "2026-09-30: one icon per element type (frame, capture, rectangle, ellipse, polygon, line, arrow, cross, pen path, text, group), from the kind, the Fabric type and sfShape"
  - "2026-09-30: `hasInstructions` is the single rule behind the row dot, the footer count and (later) the canvas pins"
  - "2026-09-30: the footer counts elements, not group rows; hidden when there is no element"
  - "2026-09-30: lock and eye show when active, and on hover to act (mockup)"
  - "2026-09-30: the frame and group chevron is a marker only; collapsing is not in the mockup"
---

**What**: the redesigned layers panel. Verified in the browser E2E (light and
dark): icons per type, instruction dot and "1 of 7 elements have instructions",
empty state, hidden row, hover controls.

**Pitfalls**:
- A live Fabric object reports its type as "i-text"; its JSON says "IText".
  Normalize to letters only before matching.
