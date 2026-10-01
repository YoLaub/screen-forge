---
id: okf-032
feature: window-picker
branch: feature/window-picker
status: done
issue: "#11 [RD-11]"
files:
  - src/canvas/WindowPicker.tsx (dialog: list, preview, loading, permission, empty)
  - src/canvas/pickerModel.ts (grouping, filtering, arrow movement)
  - src/canvas/useWindowPreview.ts (debounced, cached, bounded preview capture)
  - src/theme/tokens.ts (appTints, dialogShadow, tintTx)
  - src/canvas/CanvasView.tsx (opens on a loading state, retry, cancel-safe listing)
tests:
  - src/canvas/WindowPicker.test.tsx, src/canvas/pickerModel.test.ts, src/canvas/useWindowPreview.test.ts, src/theme/tokens.test.ts
decisions:
  - "2026-09-30: the dialog opens at once on a loading state; permission, empty and list states come from the same listing; Try again and Refresh list list again"
  - "2026-09-30: the preview reuses the capture_window command (no new command). It starts once a window has been active for 250 ms, keeps at most 6 captures, and ignores a capture that finishes after the user moved on"
  - "2026-09-30: app letter icons get golden-angle hues in order of first appearance (distinct, stable while filtering), at a lightness where a white letter keeps 3:1. A hash of the name was tried first: Safari, Chrome and Simulator all came out green"
  - "2026-09-30: the permission text says macOS may ask to reopen ScreenForge (the mockup says 'come back here'): after a grant the app often has to restart"
  - "2026-09-30: closing the dialog while it lists drops the late result, so it never reopens by itself"
---

**What**: the redesigned window picker. Verified in the browser E2E (light and dark):
loading, list with preview, three quick arrows giving one capture, filter, Enter
capturing the active window, permission (Open settings, Try again), empty (Refresh
list), Escape and scrim closing, cancel during loading.

**Pitfalls** (each found by the E2E, none by the unit tests before it was written):
- Chrome 154 `scrollIntoView()` returns a Promise. An effect written as an arrow
  expression, `useEffect(() => el.scrollIntoView(...))`, hands it to React as the
  cleanup and the whole app goes blank. Effects that call DOM methods or props use a
  block body.
- Try again replaces the button that had the focus; the focus falls to the page and
  Escape, the arrows and Enter stop reaching the dialog. Key handling lives on the
  dialog, and the search field takes the focus back on each state change.
- #10's empty-state button was covered by the canvas (no z-index): a click through
  Playwright's actionability check caught it, a screenshot could not.
