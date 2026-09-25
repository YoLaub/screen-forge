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

## sf-mcp (2026-09-23)
- First consumer E2E of sf-core: done through `screenforge-mcp` (raw JSON-RPC,
  then `claude -p --mcp-config ... --strict-mcp-config` on a fixture project).
  Running Claude Code this way does not touch the global MCP config.
- Still missing for the full US-1 loop: the app does not write `.screenforge/`
  yet. The fixture was written by hand.

## canvas (2026-09-23)
- US-1 loop closed for real: the owner pasted a screenshot in the app, the app
  autosaved `.screenforge/`, and Claude Code described it through
  `screenforge-mcp`. Drag-and-drop was not planned; the owner hit it in the
  first real-app test and it was added in the same feature.
- Browser E2E (Playwright on Vite with a stubbed `__TAURI_INTERNALS__.invoke`)
  covers the front, but not Tauri window settings such as `dragDropEnabled`:
  those need the real app.
- A leftover Vite from a Playwright check held port 1420 and made
  `pnpm tauri dev` fail: stop helper servers by PID, `pkill -f` patterns missed it.

## annotations-links (2026-09-23)
- The inspector layout bug only showed up as "clicks miss after typing": the
  first fix idea (focus stealing Backspace) was wrong. Measuring `scrollLeft`
  and the canvas `getBoundingClientRect()` found the real cause.
- Opening the inspector shrinks the canvas, so the viewport center moves: a new
  node is placed at the center of the visible area, not of the window.

## capture (2026-09-24)
- Every capture bug was diagnosed from evidence, not guessed: a standalone xcap
  dump (only the menu bar visible → missing permission), the saved PNGs' alpha
  (100 % transparent → an overlay window), and a Swift dump of the window list
  on the failing desktop (Chrome's tab-strip overlays in front of its window).
- Screen Recording in dev belongs to the terminal that launched `tauri dev`,
  and granting it means quitting that terminal: test capture in the packaged
  app instead.
- Ad-hoc signed builds get a new identity on each rebuild; macOS keeps showing
  the old grant as enabled while the new build is denied. After each rebuild:
  `tccutil reset ScreenCapture dev.screenforge.desktop`, then grant again.
  A stable local signing identity would remove this step (not done yet).
- The shortcut's first design (open the picker) failed across desktops and
  did not match what the owner expected (an instant capture).

## canvas-understanding (2026-09-24)
- A suspected zoom bug was a misread screenshot (displayed downscaled). Pixel
  measurements in the page settled it before any code change.
- An empty `nodes/` after a test looked like data loss; it was the owner's own
  clean-up. The investigation still found a real path to data loss (save after
  a failed load) and closed it.
- Claude, given only the MCP, described the login screen's element order, the
  column offset and the open questions (email or username, where to go after
  login): the layout information is what makes the difference.

## mcp-setup (2026-09-24)
- tauri-build checks `bundle.externalBin` at compile time: declaring the
  sidecar in the main config would break `cargo test` and CI where the binary
  is not built. It lives in `tauri.bundle.conf.json`, used by `pnpm bundle`.
- An app started from the Dock does not get the terminal's PATH: the `claude`
  CLI is found through a login shell (`$SHELL -lc 'command -v claude'`).
- Claude Desktop rewrites its config on restart (UI state under
  `preferences`): compare configs by key path, and only check that our merge
  touched `mcpServers`.
- The registrations point into `target/release/bundle/...` for now; they must
  be redone once the app lives in /Applications (the panel shows
  "Points to another server").

## shapes-text (2026-09-24)
- The Claude Code / Claude Desktop registrations point at the bundled server,
  which only gets new node fields after `pnpm bundle`. Until then they silently
  miss `text` (no error): an old server reading a newer file is the risk to
  watch whenever the node model grows.

## styles (2026-09-24)
- The line's phantom black fill was caught by reading the exported payload in
  the browser E2E, not by the UI: always inspect what the agent will receive.
- toNodeRecord had grown one positional parameter per feature; it now takes
  named extras before adding style.

## pen (2026-09-24)
- The owner tested an app window still running the previous front code: hot
  reload did not reach it, although Vite served the new files. The dev app is
  now restarted before every owner test of a front change.

## layers-booleans (2026-09-24)
- The empty layers panel was found by a failed check in my own E2E; reading
  the screenshot and the row count (0) before retrying led straight to the
  cause (shapes tagged after `object:added`).
- The owner's only remark: no Cmd+Z. Undo was never planned; booleans keep
  their originals hidden to stay recoverable in the meantime.

## undo (2026-09-24)
- Every save call site became `commit()` (record + save); one call with a
  slightly different shape (`() => autosave.schedule()`) escaped the automatic
  replacement and was caught by grepping the remaining calls.

## v1 milestone (2026-09-24)
- Scope grew twice on the owner's call, both for good reasons: "canvas
  understanding" replaced agent writes as goal 4 (the bridge is first about the
  agent understanding what to build), and undo joined v1 after the first real
  use of booleans.
- What made the difference for the agent, in order: the PNG as a real image
  block, positions and frames in reading order, then text and CSS-like styles.
  Each was validated by asking `claude -p` to describe or rebuild the owner's
  own canvas, not a fixture.
- Most real bugs came from the OS and the WebView, not from the logic:
  Screen Recording ownership, macOS desktops, overlay windows, Chrome's
  full-screen layers, Tauri swallowing drops, flex overflow scrolling. Each was
  settled by measuring (window dumps, pixel alpha, scrollLeft) before fixing.
- Process slips worth keeping in mind: an E2E against a stale MCP binary, a
  dev window still running old front code, a misread downscaled screenshot.
- Still manual: the ad-hoc signed bundle loses its Screen Recording grant on
  every rebuild (next step: a stable local signing identity).

## signing (2026-09-24, dropped)
- A self-signed "ScreenForge Dev" identity signed the first build, then the
  next rebuild triggered a keychain prompt: codesign needs the login keychain
  password to reach the private key, and the owner does not know it (it can
  differ from the macOS session password). The owner declined a dedicated
  signing keychain; signing stays ad hoc. The certificate and its trust setting
  were then removed from the login keychain (no keychain password needed).
