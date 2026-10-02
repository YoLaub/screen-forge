---
id: okf-041
feature: region-capture
branch: feature/region-capture
status: done-unverified-natively
files:
  - src-tauri/src/region.rs (extract: rectangle and outline cut, region_begin / frame / finish / cancel)
  - src/RegionOverlay.tsx, src/regionShape.ts (full-screen drawing surface, shape helpers)
  - src/Pill.tsx (Capture a region action), src/main.tsx (?window=region route)
tests:
  - src-tauri: region::tests (rectangle, Retina scale, backwards drag, clamping, tiny area, outline mask)
  - src/regionShape.test.ts, src/RegionOverlay.test.tsx, src/Pill.test.tsx
decisions:
  - "2026-10-02: the screen under the cursor is frozen first, then shown full screen in an NSPanel above everything; the user draws on the frozen shot, so the overlay and the pill are never in the capture"
  - "2026-10-02: a rectangle keeps everything inside; a hand-drawn outline keeps its bounding box with everything outside the outline transparent (same idea as the cut tool)"
  - "2026-10-02: button of the pill only, no global shortcut (owner)"
  - "2026-10-02: the result enters the canvas as a capture named Screen region, through the same shortcut-capture event"
---

**What**: a pill action that freezes the screen, lets the user draw a rectangle or an
outline (Esc cancels) and adds that area to the canvas with the usual instruction card.

**Checked**: the cutting code by Rust tests; the overlay by component tests and, in the
browser with a stand-in screen shot, the dimming outside the selection and the shapes sent
to the backend. NOT checked: the real full-screen panel (does the window sit exactly on the
screen, menu bar included; keyboard focus for Esc; several screens), which needs someone
at the Mac.

**Pitfall**: an overlay shifted down by the menu bar would put the cut off by that many
pixels. The overlay is created at the screen's origin with no title bar; verify on the Mac.
