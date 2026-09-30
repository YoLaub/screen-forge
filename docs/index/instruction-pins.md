---
id: okf-027
feature: instruction-pins
branch: feature/instruction-pins
status: done
issue: "#6 [RD-06]"
files:
  - src/canvas/pins.ts (pinNumbers, pinPlacement)
  - src/canvas/InstructionPins.tsx (pins and hover callout, HTML overlay)
  - src/canvas/CanvasView.tsx (pins recomputed after each Fabric render)
  - src/theme/tokens.ts, src/index.css (pin shadow token)
tests:
  - src/canvas/pins.test.ts, src/canvas/InstructionPins.test.tsx
decisions:
  - "2026-09-30: pins are numbered in layers order (top to bottom) from the rows' `instructed` flag, the same rule as the layer dots and the coverage count; hidden elements and group rows get none"
  - "2026-09-30: pins are an HTML overlay positioned from each node's bounding box through the viewport transform, recomputed on Fabric's after:render; React state only changes when a pin changed"
  - "2026-09-30: the callout shows on hover only when no single element is selected (the inspector already shows its text)"
  - "2026-09-30: display only: pins are not Fabric objects, so they never reach canvas.json, exports or the agent images"
---

**What**: numbered magenta pins on the elements that have instructions for the
agent. Verified in the browser E2E (light and dark): placement, hover callout,
pins following zoom, a new pin appearing while typing instructions, click
selecting the element, numbering following the layers order.
