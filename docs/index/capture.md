---
id: okf-006
feature: capture
branch: feature/capture
status: done
files:
  - src-tauri/src/capture.rs (xcap boundary, window levels, frontmost, blank check)
  - src-tauri/src/lib.rs (Cmd+Shift+X global shortcut)
  - src/canvas/WindowPicker.tsx (picker, permission message)
  - src/canvas/CanvasView.tsx (Capture window button, shortcut events)
tests:
  - src-tauri/src/capture.rs (filtering, frontmost, blank, PNG; window levels test is #[ignore], needs a macOS session)
  - src/canvas/WindowPicker.test.tsx
decisions:
  - "2026-09-24: button opens a picker of the current desktop's windows; Cmd+Shift+X captures the window in front without bringing ScreenForge forward (bringing it forward switched desktop and hid the window)"
  - "2026-09-24: only kCGWindowLayer 0 windows are offered, read with the objc2 CoreGraphics crates xcap already uses (a name denylist broke with localized names)"
  - "2026-09-24: the shortcut captures the largest window of the app in front (full-screen Chrome stacks transparent overlays in front of its window)"
  - "2026-09-24: a fully transparent capture is an error, never an empty node"
  - "2026-09-24: bundle identifier dev.screenforge.desktop (an identifier ending in .app conflicts with macOS bundles)"
---

**What**: capture OS windows onto the canvas, from a picker or with Cmd+Shift+X
from any app and any desktop. Verified by the owner in the packaged
`ScreenForge.app` (Chrome full screen, Terminal, other desktops), then
`claude -p` + `screenforge-mcp` described a Chrome capture.

**Pitfalls**: see retro.md (Screen Recording permission, desktops, window levels).
