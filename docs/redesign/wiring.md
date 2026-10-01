# Redesign wiring audit

"Backend" here is the Tauri commands (`src-tauri/src`), `sf-core` and the
`screenforge-mcp` server. Each data point the mockup shows gets three answers:
1 · the command or file exists, 2 · the front calls it, 3 · it carries the field shown.
Checked in code on 2026-09-30 (branch `dev`), not from docs.

Status: **ok** (1-2-3 yes), **front** (backend ok, UI work only), **gap** (backend
missing: needs a spec and a consuming ticket), **decide** (conflict or scope question for
the owner).

| Block | Data or action | 1 | 2 | 3 | Status | Notes |
|---|---|---|---|---|---|---|
| titlebar | project folder name | `get_last_project` | yes | path | front | name derived from the path |
| titlebar | "Saved 14:03" | `save_canvas` | yes | n/a | front | today in the status line |
| titlebar | agent pill "Claude Code · connected" | `agent_status` | only when the dialog opens | `registered` | front | call it at start and after Connect |
| titlebar | "read the canvas · just now" | none | no | no | **gap** | the MCP server records nothing about reads |
| titlebar | Export, label follows selection | `export_png` | yes | yes | front | moves from the canvas toolbar to the title bar |
| titlebar | traffic lights inside a 44 px bar | window config | n/a | n/a | front | `titleBarStyle: Overlay` + drag region |
| layers | typed icons (frame, capture, rectangle, cross, text) | node kind + `sfShape` | yes | kind only for rect / ellipse / text | front | icon from the Fabric type |
| layers | instruction dot, "N of M elements have instructions" | node props | yes | `sfInstructions` | front | one shared predicate for dot, count and pins |
| canvas | link arrow trigger chip | `sfLinks[].trigger` | yes | yes | front | arrows are straight today |
| pins | numbered pins, hover callout | `sfInstructions` | yes | yes | front | numbering = layers order |
| toolbar, cut-bar, boolean-bar, zoom, toast, empty-canvas | UI only | n/a | n/a | n/a | front | cut-bar must keep the Ellipse mode |
| inspector | type chip, id, Copy id | node props | yes | yes | front | clipboard write |
| inspector | ⌘↵ in instructions | none | n/a | n/a | **decide** | the mockup does not say what it does |
| inspector | Capture "Source" | none | no | no | **gap** | only baked into the name at capture time |
| inspector | Capture "Captured" time | none | no | no | **gap** | not stored |
| inspector | Capture "Size" | image natural size | yes | yes | front | |
| inspector | Frame "Contains N elements" | `assignParents` | yes | yes | front | |
| picker | windows grouped by app, size | `list_windows` | yes | `app_name`, `width`, `height` | front | |
| picker | "live window preview" | `capture_window` | on pick only | full PNG | front | capture on hover, debounced; heavier, no new command |
| picker | loading, Try again, Refresh list | `list_windows`, `ensure_screen_capture_access` | yes | yes | front | |
| connect | "MCP server running" + project path | none | no | no | **decide** | no server runs between agent sessions: the line would be false as written |
| connect | client states and buttons | `agent_status`, `configure_*` | yes | yes | front | "Connecting…" = busy flag, "Connection failed" = error string |
| connect | "last read the canvas at 14:05 · 8 elements, 4 with instructions" | none | no | no | **gap** | same source as the title bar note |
| home | Recent projects (name, path, when) | `get_last_project` only | yes | one path, no date | **gap** | `sf-core::app_state` keeps a single path |
| home | "or drop one here" (folder) | none | no | no | **dropped** | folder drop and web image drop cannot both work (RD-17 abandoned, see Decisions) |
| home | ⌘O, "Opening … / Loading 8 elements" | `load_canvas` | yes | count after load | front | |
| pill | whole panel | none | no | no | **decide** | new non-activating always-on-top window: new feature and architecture choice |
| pill | "Added next to “Login screen”" | none | no | no | **decide** | placement rule not specified (captures land at the viewport center today) |

## Gaps (specs to write, each with its consuming ticket)

1. **Agent reads** — `screenforge-mcp` records each tool call (time, tool, node count,
   nodes with instructions) in `.screenforge/`; the app reads it for the title bar note
   and the Connect AI footer. Owner of the layout: `sf-core`.
2. **Capture metadata** — store the source app and capture time on capture nodes
   (`sfSource`, `sfCapturedAt`), exported in `node.json` so the agent sees them too.
3. **Recent projects** — `sf-core::app_state` keeps a list (path, last opened) instead of
   one path; a command returns it.
4. ~~Folder drop on Home~~ — abandoned, see Decisions.

## Decisions (owner, 2026-09-30)

- **Edge pill** — later, then built on 2026-10-01 at the owner's request (card `docs/index/edge-pill.md`).
- **"MCP server running"** — show what is true: "MCP server ready" when the binary is
  found (red dot when it is missing), plus the project path.
- **Theme** — follows the macOS appearance, no manual switch.
- **Backlog** — GitHub issues, milestone "Redesign", label `redesign`.
- **Post-mockup features** (defaults, kept) — ellipse cut (4 cut modes), context menu,
  groups (group rows get their own icon), merge layers, Shift axis lock.
- **Fonts** (default) — Geist and Geist Mono (SIL OFL) bundled, not loaded from Google Fonts.
- **⌘↵ in the instructions** (default, to confirm) — leaves the field, like Esc, without
  discarding the text.
- **Folder drop on Home (RD-17), abandoned 2026-10-01.** The issue assumed the Tauri
  drag-drop event could be listened to on Home only, while the canvas kept its web image
  drop. It cannot: with `dragDropEnabled: true`, Tauri's handler in `tauri-runtime-wry`
  always returns `true`, and wry's macOS code then swallows every drop (`performDragOperation`
  answers YES instead of passing it to the page). A web drop, on the other hand, gives a
  dropped folder's name only, never its path. So a folder drop means giving up the web image
  drop on the canvas and rewriting it on native paths (images dragged out of a browser page
  carry no file path and would stop working). The owner chose not to: folders open with
  "Open a folder", Cmd+O and the Recent list, and image drop stays as it is. Reopen only if
  Tauri gains a way to switch drag-drop at runtime, or to pass a drop to the page.
