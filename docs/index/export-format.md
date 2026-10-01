---
id: okf-040
feature: export-format
branch: feature/export-format
status: done
files:
  - src-tauri/src/export.rs (encode, export_image command)
  - src/canvas/exportOptions.ts (formats, qualities, extension, saved settings)
  - src/TitleBar.tsx (Export button with an options menu), src/App.tsx (settings kept in localStorage)
  - src/canvas/CanvasView.tsx, src/services/backend.ts (format-aware save dialog and command)
tests:
  - src-tauri: export::tests (markers, size order by quality, white under JPG, WebP size)
  - src/canvas/exportOptions.test.ts, src/TitleBar.test.tsx, src/App.test.tsx
decisions:
  - "2026-10-01: JPG, WebP and PNG are encoded in Rust (image + libwebp), not with the page's canvas: WKWebView cannot be trusted to encode WebP"
  - "2026-10-01: quality is low / medium / high = 50 / 75 / 92 for JPG and WebP; PNG is lossless and ignores it (the menu says so)"
  - "2026-10-01: JPG has no transparency, so transparent areas are laid over white"
  - "2026-10-01: the choice is remembered (localStorage, screenforge.export); the main button exports with it, the chevron opens the menu"
  - "2026-10-01: new dependencies: image (png, jpeg) and webp (libwebp), both MIT or Apache"
---

**What**: the Export button saves the canvas, a frame, an element or a selection as PNG,
JPG or WebP, in low, medium or high quality. The command `export_png` became `export_image`.

**Checked**: Rust encoders by tests; the menu in the browser (light theme, PNG then JPG
and Medium, choice saved). Not checked: the native "Save as" dialog and a real file opened
in Preview, which need a person at the Mac.
