---
id: okf-035
feature: collapsible-panels
branch: feature/collapsible-panels
status: done
files:
  - src/canvas/panels.ts (fold state, Shift+Cmd+H, remembered in localStorage)
  - src/canvas/PanelOpener.tsx (button that brings a folded panel back)
  - src/canvas/LayersPanel.tsx, src/canvas/NodeInspector.tsx (hide button in each header)
  - src/canvas/CanvasView.tsx (what is shown, the shortcut)
tests:
  - src/canvas/panels.test.ts, src/canvas/PanelOpener.test.tsx, src/canvas/LayersPanel.test.tsx, src/canvas/NodeInspector.test.tsx
decisions:
  - "2026-10-01: each side panel folds from a button in its header; a Layers / Inspector button at the matching edge of the canvas brings it back (the Inspector one only while an element is selected)"
  - "2026-10-01: Shift+Cmd+H folds or brings back both panels. A letter on purpose: Cmd+backslash, Figma's key, needs Alt+Shift on an AZERTY keyboard"
  - "2026-10-01: the shortcut judges by what is on screen: a closed floating Layers panel, or an Inspector with nothing selected, counts as folded, so the first press always changes something visible"
  - "2026-10-01: the folded state is remembered (localStorage, guarded: blocked or corrupt storage falls back to both open). It is a per-viewer convenience, not project data"
  - "2026-10-01: below 1200 px the Layers panel still floats; its header button closes it, and it is opened by the same Layers button as before"
---

**What**: fold the Layers and Inspector side panels. Verified in the browser E2E:
canvas widening to 1164 / 1400 px, folded Inspector staying folded across
selections, reopening, the shortcut from three starting situations, memory
across a reload, and the floating mode.

**Pitfalls**:
- In a JSX attribute `title="a\\b"` shows two backslashes (no escape processing);
  the same text in a JS expression shows one. Moot once the shortcut became a letter.
- The E2E read the screen 150 ms after a key press while Vite was still compiling
  the edited file, and drew a wrong conclusion. Waiting 300-400 ms settled it.
