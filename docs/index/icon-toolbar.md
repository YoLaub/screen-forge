---
id: okf-024
feature: icon-toolbar
branch: feature/icon-toolbar
status: done
issue: "#3 [RD-03]"
files:
  - src/canvas/Toolbar.tsx (floating toolbar, flyouts, cut sub-bar)
  - src/canvas/toolIcons.tsx (mockup icons)
  - src/canvas/tools.ts (TOOL_GROUPS, rememberInGroup, TOOL_META, toolTitle, CUT_HINTS)
  - src/canvas/CanvasView.tsx (old text toolbar removed)
tests:
  - src/canvas/tools.test.ts, src/canvas/Toolbar.test.tsx
decisions:
  - "2026-09-30: 8 buttons: Select, Frame | shapes group (Rectangle, Ellipse, Polygon) | lines group (Line, Arrow), Cross, Pen, Text | Cut | Capture window; each shows its key letter"
  - "2026-09-30: a group button shows the last tool used in its group, whether picked from the flyout or by key"
  - "2026-09-30: the cut sub-bar keeps the Ellipse mode (post-mockup) with a hint in the mockup's voice"
  - "2026-09-30: flyouts are a small in-house menu (2-3 items), no extra Radix package"
  - "2026-09-30: boolean ops sit under the toolbar until they move under the selection (#8)"
---

**What**: the redesigned icon toolbar. Verified in the browser E2E (light and
dark): flyout pick, key switching the group button, drawing, cut modes and hint,
Capture window opening the picker.
