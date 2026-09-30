---
id: okf-023
feature: title-bar
branch: feature/title-bar
status: in-progress
issue: "#2 [RD-02]"
files:
  - src/TitleBar.tsx (44 px bar), src/Logo.tsx (brand mark)
  - src/titleBarState.ts (agent pill state, save label)
  - src/App.tsx (agent status at start, save time, export handle)
  - src/canvas/CanvasView.tsx (onSaved, onExportLabel, controls; Export button removed)
  - src-tauri/tauri.conf.json (overlay title bar), src-tauri/capabilities/default.json (window dragging)
tests:
  - src/titleBarState.test.ts, src/App.test.tsx
decisions:
  - "2026-09-30: the native title bar becomes an overlay (hidden title, traffic lights at 14,22) inside a 44 px web bar; empty areas carry data-tauri-drag-region"
  - "2026-09-30: agent pill uses the Connect AI rule (a client registered with this app's MCP binary), Claude Code first; agent status is loaded at start and after connecting"
  - "2026-09-30: Export moves from the canvas toolbar to the title bar; the canvas exposes exportPng through a controls ref and reports its label"
  - "2026-09-30: save time leaves the status line; errors stay there until toasts (#10)"
  - "2026-09-30: the 'read the canvas · just now' note waits for agent reads (#14)"
---

**What**: the redesigned title bar: project switcher, save state, agent pill and
Export. Verified in the browser E2E (light and dark). Pending: the owner checks
the traffic lights position and window dragging in the Tauri app (this session
cannot capture the screen).

**Pitfalls**:
- macOS file names ignore case: `titleBar.ts` next to `TitleBar.tsx` breaks the
  TypeScript build; the logic module is `titleBarState.ts`.
