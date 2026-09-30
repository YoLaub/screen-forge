# Redesign inventory

Source of truth: `design/screenforge-ui-redesign-mockups/project/ScreenForge Redesign.dc.html`
and the files it imports (`SF Workspace`, `SF Window Picker`, `SF Connect AI`, `SF Home`,
`SF Edge Pill`, all `.dc.html`). `support.js` is the prototype runtime, not design.
Light and dark themes are both specified (token sets in the Redesign file).

The mockup was made from the 2026-09-26 brief. Features added after it (ellipse cut,
context menu, groups, merge layers, Shift axis lock) are not in it and are kept.

A box is checked when its logic is extracted below (phase 1). Coverage by the current
app is in the status column of `wiring.md` (phase 2), not here.

## Checklist

- [x] `tokens` — Theme tokens (light / dark), Geist + Geist Mono, 12 px base
- [x] `titlebar` — Title bar: traffic lights, logo, folder switcher, save state, agent pill, Export
- [x] `layers` — Layers panel: typed rows, instruction dot, lock / eye on hover, coverage footer, empty state
- [x] `layers-narrow` — Layers as a floating panel below 1200 px, opened from a "Layers" button
- [x] `canvas` — Canvas: dotted grid, frame labels, curved link arrows with trigger chip, selection box with size label
- [x] `pins` — Numbered instruction pins on the canvas, hover callout, click selects
- [x] `toolbar` — Floating icon toolbar with shortcut letters, shape and line flyouts, Capture window
- [x] `cut-bar` — Cut sub-bar: mode segments and a hint per mode
- [x] `boolean-bar` — Boolean bar under a multi-selection of shapes
- [x] `zoom` — Zoom control: −, percentage, +, Fit all
- [x] `toast` — Error toast on the canvas
- [x] `empty-canvas` — Empty canvas state
- [x] `inspector` — Inspector: header, name, instructions block, links cards, collapsible style, capture and frame sections
- [x] `keys` — Workspace keyboard map
- [x] `picker` — Window picker: search, grouped list, preview, loading, permission, empty, footer
- [x] `connect` — Connect AI: MCP line, client cards with states, result messages, last-read footer
- [x] `home` — Home: logo, Open a folder card, opening state, Recent projects
- [x] `pill` — Edge pill: floating panel docked to the screen edge (collapsed, expanded, just captured)

## Extraction

Six questions per block: data shown, states, actions, entry / exit, implicit rules,
vocabulary.

### `tokens`
- Data: light `--bg #f2f3f5`, `--panel #fff`, `--panel2 #f5f6f8`, `--canvas #e6e8ec`,
  `--dot rgba(17,20,32,.13)`, `--acc #0a7f97` (teal: tools, selection), `--sel #0ea5c0`,
  `--ag #a92fbb` (magenta: only what the agent reads), `--warn #c2530f`, `--ok #1b8a4c`,
  `--link #8a8f9c`, texts `#14161c / #555b69 / #868b98`. Dark set: `--bg #111319`,
  `--panel #181b22`, `--canvas #0b0c10`, `--acc #2fc7df`, `--ag #e279f0`, `--ok #45d98a`,
  `--warn #ff9a5c`. Logo gradient `#1fc8dc → #4b5cf0 → #c23bd0`.
- States: light, dark.
- Rules: teal = tools and selection; magenta = anything the agent reads. Base font 12 px
  Geist; numbers, ids, shortcuts in Geist Mono.
- Vocabulary: "For the agent", "Instructions for the agent".

### `titlebar`
- Data: project folder name ("acme-dashboard"); "Saved 14:03" with a check icon; agent
  pill "Claude Code" + note ("read the canvas · just now" / "connected"); Export label.
- States: agent connected (green dot pill) / not connected ("Connect AI", teal outline).
- Actions: folder button = Change folder; agent pill = Connect AI dialog; Export button
  (primary) = export, label "Export canvas / frame / element / selection".
- Rules: 44 px high, macOS traffic lights inside the bar; the agent state lives here.
- Vocabulary: "Change folder", "Connect AI", "Saved", "Export …".

### `layers`
- Data: rows 28 px: frame chevron, type icon (frame, capture, rectangle, cross, text),
  name (frames bold), magenta dot "Has instructions for the agent", lock, eye; indent
  16 px per level; footer "**4** of 8 elements have instructions".
- States: empty ("No layers yet. Captures, frames and annotations will be listed here."),
  selected row (teal soft background, teal icon), hidden row (50 % opacity), locked.
- Actions: row click selects (Shift adds); lock and eye toggles, shown on hover or when
  active; header "Bring forward (⌘])", "Send backward (⌘[)".
- Rules: 236 px wide; footer counts elements with non-empty instructions over all rows.

### `layers-narrow`
- Rules: below 1200 px window width, Layers is hidden; a "Layers" button top-left of the
  canvas opens it as a floating panel with a shadow; clicking the canvas closes it.

### `canvas`
- Data: dotted background (1 px dots every 20 px); frame name above each frame (teal
  when selected); link arrows as curves with an arrowhead, a mono chip with the trigger
  ("onClick"); selection box 1.5 px teal, 4 corner squares, size chip "236 × 44" below.
- Actions: click empty canvas deselects.

### `pins`
- Data: magenta pin (20 px, rounded with a sharp bottom-left corner) at the top-right
  corner of each element with instructions, numbered 1..n.
- States: hover a pin → callout "For the agent · <name>" + instruction text (only when
  nothing single is selected).
- Actions: click a pin selects its element.
- Rules: numbering follows the layers order (top to bottom); the inspector shows the
  same number next to "Instructions for the agent".

### `toolbar`
- Data: Select (V), Frame (F) | shapes button showing the last shape (Rectangle R,
  Ellipse O, Polygon) + flyout ▾ "More shapes"; line button (Line L, Arrow A) + flyout
  "Line or arrow"; Cross (X), Pen (P), Text (T) | Cut (C) | "Capture window" (teal).
  Each button shows its key letter bottom-right.
- States: active tool (teal soft background); flyout open.
- Rules: centered at the top of the canvas; 8 buttons instead of 11.

### `cut-bar`
- Data: segments "Lasso / Line / Rectangle"; hints "Circle an area of a capture",
  "Drag across a capture to split it", "Drag a box over a capture".
- Rules: shown under the toolbar while Cut is active.

### `boolean-bar`
- Data: "2 shapes" + Union, Subtract, Intersect, Exclude, under the selection box.
- Rules: only when more than one shape (not text) is selected.

### `zoom`
- Data: "80%"; buttons "Zoom out (⌘−)", "Zoom in (⌘+)", "Fit all ⇧1".
- Rules: bottom-left; steps ×1.25 / ×0.8, bounds 10 %–400 %; zoom around the center.

### `toast`
- Data: warn icon "!", title "Nothing to cut", message "Draw over a capture to cut a
  piece out.", close ×.
- Rules: bottom-center of the canvas, warn border; replaces the status line errors.

### `empty-canvas`
- Data: "Show the agent something"; "Capture any window on your Mac, or paste / drop an
  image here. Then annotate it and tell the agent what to do."; "Capture window";
  "or paste ⌘V"; "Tip: ⌘⇧X captures the frontmost window from anywhere."

### `inspector`
- Data: type chip ("RECTANGLE"), id ("RCT_8QK2M1"), "Copy id"; name (15 px, inline edit).
- Instructions block (magenta): title "Instructions for the agent", pin number badge,
  textarea (placeholder "What should the agent do with this element?", 7 rows),
  "Sent with the image, position, style and links." and a ⌘↵ chip.
- Links: count or "None yet"; one card per link: target name, target type, remove ×,
  "Trigger" (e.g. onClick) and "Payload" (e.g. ApiResponse<User>); dashed select
  "Link to: Choose a node…" with options "<name> · <Type>".
- Style (collapsible, shapes and text only): Fill segments None / Solid / Linear /
  Radial; solid: swatch + hex + opacity %; gradient: preview + "2 stops" + angle; Stroke
  hex + "W" width; Corner radius; text: Color, Font size, Weight Regular / Bold; Opacity
  slider + %.
- Capture section: "Source" (app), "Size" ("1280 × 864"), "Captured" ("Today, 14:01"),
  "Captures have no style. Press C to cut a piece out."
- Frame section: "Contains 4 elements. Moving the frame moves its content."
- Rules: 300 px; instructions come right after the name.

### `keys`
- V F R O L A X P T C select tools; Esc returns to Select (and blurs a field); ⇧1 fits;
  ⌘↵ in the instructions (see wiring, meaning unspecified).

### `picker`
- Data: search "Capture which window?" + esc chip; list grouped by app (app letter icon
  tinted per app, window title, size "1280 × 864", ↵ on the active row); preview pane:
  "live window preview", title, "<app> · <size>", "Capture to canvas".
- States: list, no match ("No window matches “q”."), loading (skeleton, "Looking for open
  windows…"), permission ("Screen Recording permission needed", "Open Screen Recording
  settings", "Try again", "You can still paste or drop images onto the canvas."), empty
  ("No window to capture.", "Open the app you want to show the agent, then try again.
  Minimized windows and other Spaces aren't listed.", "Refresh list").
- Actions: type filters on app + title; ↑↓ move; ↵ / click captures; hover moves the
  active row.
- Footer: "↑↓ navigate", "↵ capture", "From anywhere: ⌘⇧X captures the frontmost window".

### `connect`
- Data: "Connect AI agents", subtitle; line "MCP server running" + project path
  "acme-dashboard/.screenforge"; per client (Claude Code, Claude Desktop): icon, status
  dot + text, button, message strip.
- States: Not installed / Not connected / Connecting… / Connected / Points to another
  server / Connection failed; buttons Connect / Connecting… / Reconnect / Update / Retry
  (teal when Not connected, Points to another server, failed).
- Messages: "Connected. Start a new Claude Code session to pick it up.", "Connected.
  Restart Claude Desktop to load the server.", "Registered to another ScreenForge server.
  Update to point it at this project.", "Claude Desktop isn’t installed on this Mac.",
  "Couldn’t write ~/.claude.json (permission denied). Check the file’s owner, then retry."
- Footer: "Claude Code last read the canvas at 14:05 · 8 elements, 4 with instructions" /
  "No agent has read this canvas yet."

### `home`
- Data: logo, "ScreenForge", "Pick the project folder. The canvas is saved in its
  .screenforge/ folder."; card "Open a folder / or drop one here / ⌘O"; "Recent" list:
  name, path, when ("Today", "Yesterday", "12 Sep").
- States: idle; opening ("Opening acme-dashboard…", "Loading 8 elements from
  .screenforge/").

### `pill`
- A separate floating panel on the right screen edge that does not take focus (the
  frontmost window stays the capture target), draggable vertically.
- Collapsed: 14 × 72 px tab, logo gradient bar, agent dot.
- Expanded on hover: drag handle, logo, "Capture frontmost window ⌘⇧X" (teal),
  "Choose a window…", "Paste image from clipboard", "Open ScreenForge canvas"; tooltips;
  agent dot + instruction count ("Claude Code connected · 4 instructions on canvas").
- Captured: the captured window flashes; card with thumbnail, "Captured to canvas",
  "<source>", "Added next to “Login screen”", textarea "Tell the agent what to do with
  it…", "Open in ScreenForge", "Undo".
