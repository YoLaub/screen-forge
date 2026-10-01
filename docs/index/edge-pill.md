---
id: okf-039
feature: edge-pill
branch: feature/edge-pill
status: done-unverified-natively
issue: "wiring.md, block pill"
files:
  - src-tauri/src/pill.rs (window creation, geometry, pill_set_state, pill_set_top, show_main_window)
  - src-tauri/src/lib.rs (capture_front command, main window hides on close, Dock reopen)
  - src/Pill.tsx (collapsed tab, action bar, capture card), src/pillState.ts (modes, agent line, card rules)
  - src/canvas/CanvasView.tsx (answers pill requests: pick, paste, undo, instructions, hello; sends the instruction count)
  - src/services/backend.ts (pill commands and events)
tests:
  - src-tauri: pill::tests (geometry), src/pillState.test.ts, src/Pill.test.tsx
decisions:
  - "2026-10-01: a second Tauri window (label pill, route ?window=pill), always on top, visible on all workspaces, transparent; no NSPanel and no third-party crate"
  - "2026-10-01: the pill does not need to avoid taking focus: capture_frontmost already skips ScreenForge's own windows, so the target stays the window in front of the app"
  - "2026-10-01: follows desktops and apps, not physical screens: it sits on the screen of the main window, else the primary one"
  - "2026-10-01: closing the main window hides it (canvas stays alive for the pill); the Dock icon or the pill brings it back"
  - "2026-10-01: transparency needs Tauri's macOSPrivateApi (Cargo feature + tauri.conf.json); fine for a direct download, not for the Mac App Store"
  - "2026-10-01: left out of the mockup: the capture flash overlay and the line Added next to <frame> (no placement rule exists; captures land at the view center)"
---

**What**: a floating tab on the right edge. Hover opens an action bar (capture the
window in front, choose a window, paste an image, open the canvas, agent dot and
instruction count). After a capture a card shows the thumbnail, the source, a field for
instructions (written to the capture node) and Open / Undo. The card leaves by itself
after 10 s when untouched.

**Checked**: Rust geometry and UI logic by tests (392 front tests, all green). In the
dev app, the window list shows the pill at 14 x 72, flush with the right edge, at
window level 5 (floating). Hover, drag, desktop changes, full-screen apps and paste were
NOT checked: no one could look at the screen.

**Pitfalls**:
- The pill asks the canvas for its summary on start (`hello`), because the main window
  may have announced it before the pill listened.
- Pasting reads the clipboard in the main webview; WebKit may ask for a confirmation.
