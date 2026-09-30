---
id: okf-029
feature: canvas-visuals
branch: feature/canvas-visuals
status: done
issue: "#8 [RD-08]"
files:
  - src/canvas/canvasVisuals.ts (gridBackground, linkCurve, bezierPoint, selectionOverlay)
  - src/canvas/CanvasView.tsx (grid on the container, curved links with trigger chip, frame labels, selection style, size chip, boolean bar)
tests:
  - src/canvas/canvasVisuals.test.ts
decisions:
  - "2026-09-30: the Fabric canvas is transparent; the canvas color and the 20 px dot grid are the container's CSS background, re-positioned after each render (the grid doubles below 8 px on screen)"
  - "2026-09-30: links are cubic curves leaving the side facing the target, with a filled arrowhead and a mono chip showing the trigger when set"
  - "2026-09-30: frame names are 12 px, teal when the frame is selected (overlays redraw on selection change)"
  - "2026-09-30: selection keeps all Fabric handles (sides, rotation) in the theme's colors; the mockup shows corners only, but removing handles would remove features"
  - "2026-09-30: size chip and boolean bar are HTML overlays placed under the selection box, updated with the pins in after:render"
---

**What**: the redesigned canvas visuals. Verified in the browser E2E (light and
dark): grid following pan, curved link with its trigger chip, teal frame label on
selection, size chip, boolean bar under a two-shape selection, agent image still
on its fixed background.
