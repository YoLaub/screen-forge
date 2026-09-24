---
id: okf-008
feature: mcp-setup
branch: feature/mcp-setup
status: done
files:
  - crates/sf-core/src/app_state.rs (last opened project, resolve_project)
  - crates/sf-mcp/src/main.rs (serves cwd project or the one open in ScreenForge)
  - src-tauri/src/agents.rs (status, Claude Code and Claude Desktop registration)
  - src-tauri/tauri.bundle.conf.json, package.json (bundle + build:sidecar)
  - src/AgentSetup.tsx, src/App.tsx (Connect AI panel)
tests:
  - crates/sf-core/src/app_state.rs
  - src-tauri/src/agents.rs (config merge and parsing)
  - src/AgentSetup.test.tsx
decisions:
  - "2026-09-24: Claude Code gets one user-scope entry through `claude mcp add --scope user` (never an edited ~/.claude.json, nothing in the repo)"
  - "2026-09-24: Claude Desktop's config is merged, never overwritten; unparsable files are refused; the original is backed up"
  - "2026-09-24: screenforge-mcp serves its working directory's project, else the project open in ScreenForge (Claude Desktop has no project folder)"
  - "2026-09-24: screenforge-mcp ships in the bundle (externalBin in a bundle-only config) and the app registers the binary next to its own"
---

**What**: a Connect AI panel registers ScreenForge's MCP server in Claude Code
and Claude Desktop in one click, with per-client status. Verified in the
packaged app by the owner: Claude Code (user scope, no extra flags) and Claude
Desktop both described the canvas through the bundled server.

**Pitfalls**: see retro.md.
