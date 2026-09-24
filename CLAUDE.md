# CLAUDE.md — ScreenForge repo conventions

## Context
ScreenForge is a lightweight desktop companion app. It captures any OS window,
annotates or draws on an infinite canvas, and exposes the canvas nodes to coding
agents through MCP. It is a personal product: it is built for the owner's own
Claude Code workflow first, and commercialization comes later.
**Problem #1: let Claude Code "see" a UI element (capture + vector spec +
annotations) and act on it locally, without copy-pasting screenshots.**

Functional reference: `cahier_des_charges_extension_screenforge.md`. When this
file and the spec disagree, this file wins (see the MCP decision below).

## Goals (v1)
Done:
1. OS-level window capture onto the canvas (macOS).
2. Infinite canvas holding capture and drawing nodes with user annotations and
   links.
3. MCP server over stdio that exposes the nodes (`get_canvas_snapshot`,
   `get_node_detail`, `get_node_dependencies`): US-1 runs end to end.
4. Agent understanding of the canvas: canvas image, node positions, frames
   (screens) with their elements in reading order, screen images.
6. One-click MCP setup for Claude Code / Claude Desktop (US-3, without OAuth).

Remaining (the owner does not consider v1 complete without it):
5. Vector drawing tools (spec module B), in four features, in this order:
   5.1 shapes and text (done), 5.2 styles (done: fill, stroke, radius, opacity, gradients),
   5.3 pen and Bézier curves, 5.4 layers panel and boolean operations
   (Paper.js).

Out of scope for v1: the agent writing to the canvas (`create_node_annotation`,
`update_node_preview`, corrections), OAuth/PKCE, Bearer/PAT, SSE/HTTP/WebSocket
transports, region capture, OCR, Windows and Linux. The v1 milestone (dev → main) and a
stable local signing identity come once goal 5 is done.

## Constraints
- macOS only in v1. Keep capture code behind an OS boundary so other platforms
  can be added later.
- No network listener in v1: MCP runs over stdio only.
- Canvas and UI dependencies must be free for commercial use (MIT or similar).
  No license-keyed SDKs such as tldraw.

## Technical decisions
- Desktop shell: Tauri v2 + Rust.
- UI: React 19 + Tailwind CSS + Radix UI.
- Canvas: Fabric.js (infinite pan/zoom and connectors built in-house).
  Boolean operations will come from Paper.js when the vector studio lands.
- Capture: `xcap`, macOS only, current desktop only. Button = window picker;
  Cmd+Shift+X = instant capture of the largest window of the app in front.
  Only normal windows (kCGWindowLayer 0) are offered.
- MCP server: Rust, using the official `rmcp` SDK. This deviates from spec §6,
  which named the TypeScript SDK: Rust avoids bundling a Node runtime. The
  server is a separate `screenforge-mcp` binary (crate `crates/sf-mcp`).
- Persistence and MCP access go through files. Each project's canvas lives in
  `<project root>/.screenforge/`: `canvas.json` (Fabric state, read by the app
  only), and `nodes/<id>/{node.json,export.svg,image.png}` written by the app
  on every save, plus `canvas.png` (whole-canvas render). `screenforge-mcp`
  reads `nodes/` and `canvas.png` only and never parses Fabric JSON. It serves
  its working directory's project, else the project open in ScreenForge
  (`sf-core::app_state`).
- `screenforge-mcp` ships next to the app binary (`Contents/MacOS/`), declared as
  `externalBin` in `src-tauri/tauri.bundle.conf.json` only. The Connect AI panel
  registers it: Claude Code via `claude mcp add --scope user`, Claude Desktop by
  merging `claude_desktop_config.json` (backup kept, unparsable file refused).
- Frames group nodes: a node's parent is the smallest larger frame containing
  its center, recomputed by the app on every save.
- `crates/sf-core` is the single owner of the `.screenforge/` layout.
- Tooling: pnpm, Vitest (front), `cargo test` (Rust).
- External docs (Fabric, rmcp, Tauri v2): use a generic doc tool. Whether a
  dedicated doc MCP is worth building: _à décider_ (not evaluated yet).

## Method
- Git: `main` + `dev` + feature branches cut from `dev`, merged back with
  `merge --no-ff`.
- TDD and local-only commits, per the global CLAUDE.md.
- Autonomy: within a validated feature, run test → implementation → commit
  without asking, then report. Stop before starting a new feature and before
  any architecture choice.

## Key rules
- A single service layer owns node data. The UI and the MCP server both
  consume it, and neither reads canvas internals directly.
- Feature cards live in `docs/index/` (one OKF card per feature). Lessons
  learned go to `retro.md`.
- MCP payloads follow the node shape in spec §7 (`id`, `type`, `name`,
  `dimensions`, `visual_context`, `connections`, `user_instructions`).

## Commands
- Run the app: `pnpm tauri dev`
- Front: `pnpm test` · `pnpm typecheck`
- Rust: `cargo test --workspace`
- MCP server: `cargo build -p sf-mcp` → `target/debug/screenforge-mcp` (run from
  the project root; register with `claude mcp add screenforge -- <path>`).
  Rebuild it before any MCP E2E: `cargo test` does not.
- Packaged build: `pnpm bundle` (builds and ships `screenforge-mcp`). Test capture there, and after
  each rebuild run `tccutil reset ScreenCapture dev.screenforge.desktop` (ad-hoc
  signing changes the app identity, so the old Screen Recording grant is stale).

BRAIN: ~/brain/screen-forge

## Journal d'erreurs

Quand un bug non trivial est résolu, append une ligne à `$BRAIN/bag.ndjson` :

{"trigger":"", "symptom":"", "root_cause":"", "fix":"", "severity":1, "date":"YYYY-MM-DD"}

- `trigger` : les termes techniques exacts qui identifient le contexte
  ("relation polymorphe Strapi v5"), pas une description du bug.
  C'est la clé de regroupement.
- `severity` : 1 friction · 2 rework · 3 irréversible (perte de données,
  CI verte à tort, prod)
- Append only, jamais d'édition, une ligne par incident.

Si le `trigger` n'est pas formulable en termes techniques précis, le diagnostic
n'est pas terminé : le dire plutôt que de logger une entrée floue.
Un bug résolu par hasard ne se logge pas.
Si aucune ligne `BRAIN:` n'est présente dans ce CLAUDE.md, ne rien logger et le signaler.
