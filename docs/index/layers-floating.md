---
id: okf-026
feature: layers-floating
branch: feature/layers-floating
status: done
issue: "#5 [RD-05]"
files:
  - src/canvas/layers.ts (layersLayout, LAYERS_DOCKED_MIN_WIDTH)
  - src/canvas/LayersPanel.tsx (floating prop)
  - src/canvas/CanvasView.tsx (window width, Layers button, close on canvas click)
tests:
  - src/canvas/layers.test.ts, src/canvas/LayersPanel.test.tsx
decisions:
  - "2026-09-30: below 1200 px window width the layers panel floats over the canvas, opened from a Layers button top-left of the canvas; a mouse down on the canvas closes it"
  - "2026-09-30: the layout follows the window width (resize event), the selection lives in Fabric and survives the switch"
---

**What**: layers as a floating panel on narrow windows. Verified in the browser
E2E at 1000 px (open, select from the panel, close on canvas click) and after
widening to 1400 px (docked again, selection kept).
