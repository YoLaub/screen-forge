# Retro — ScreenForge

## Bootstrap (2026-09-23)
- tldraw was dropped at bootstrap: since SDK 4.0 a production build needs a
  license key (free "hobby" key only with a watermark). Fabric.js chosen
  instead because it is a vector object model with native SVG export, which
  feeds `visual_context.svg` directly.
- MCP access through files rather than IPC: every v1 MCP tool is read-only,
  so a folder written on save is enough and works with the app closed.
  Revisit when the agent needs to write to the canvas (`update_node_preview`).
- Verification: `pnpm tauri dev` launched the app process and Vite served the
  page (canvas root rendered, Tailwind applied, checked in a browser). The
  native window itself could not be screenshotted from the agent session
  (no screen-recording permission for the terminal). The owner confirmed
  the window opens.

## sf-core-node-model (2026-09-23)
- There is no consumer yet, so the E2E check is the store tests themselves:
  they run on real temp folders, not mocks. The first real consumer E2E comes
  with `screenforge-mcp`.
