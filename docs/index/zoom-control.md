---
id: okf-030
feature: zoom-control
branch: feature/zoom-control
status: done
issue: "#9 [RD-09]"
files:
  - src/canvas/viewport.ts (stepZoom, zoomLabel, fitTransform, zoomKey)
  - src/canvas/ZoomControl.tsx (bottom-left control)
  - src/canvas/CanvasView.tsx (zoom state from the render loop, zoom around the view center, Fit all, shortcuts)
tests:
  - src/canvas/viewport.test.ts, src/canvas/ZoomControl.test.tsx
decisions:
  - "2026-09-30: buttons and Cmd + / Cmd = / Cmd - step the zoom by x1.25 / x0.8 around the center of the view"
  - "2026-09-30: zoom bounds stay 10 % to 800 % for the wheel and the control alike; the mockup stops at 400 %, but capping would remove pixel-level zoom"
  - "2026-09-30: Fit all (Shift+1) frames every visible node in the area left by the toolbar, the zoom control and the edges; it never magnifies past 100 %; with no node it resets to 100 %"
  - "2026-09-30: Shift+1 is matched on the key position (Digit1), not the character: QWERTY types '!', AZERTY types '1'"
  - "2026-09-30: the percentage is read from the canvas after each render, so pinch and wheel zoom update it too"
---

**What**: zoom control (−, percentage, +, Fit all) and its shortcuts. Verified in
the browser E2E: 100 -> 125 -> 80 %, Cmd = / Cmd Shift = / Cmd -, Fit all on
two frames 3000+ units from the origin (35 %, both fully visible), wheel zoom
reflected in the label, bounds at 10 % and 800 %, light and dark.

**Pitfalls**:
- Fabric renders on the next animation frame: a test that reads the percentage
  in the same tick as the click sees the previous value. Wait one frame.
