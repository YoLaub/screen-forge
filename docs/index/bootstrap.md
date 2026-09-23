---
id: okf-001
feature: bootstrap
branch: feature/bootstrap
status: done
files:
  - Cargo.toml (workspace: src-tauri, crates/sf-core)
  - src-tauri (Tauri v2 app shell, demo code removed)
  - crates/sf-core (.screenforge/ layout owner)
  - src (React 19 + Tailwind v4 shell)
  - vite.config.ts (Vite 8 + Vitest/jsdom)
  - .github/workflows/ci.yml
tests:
  - crates/sf-core/src/lib.rs (project_dir)
  - src/App.test.tsx (canvas root renders)
decisions:
  - "2026-09-23: Fabric.js replaces tldraw (tldraw SDK needs a license key in production builds)"
  - "2026-09-23: MCP reads files under <project>/.screenforge/nodes/, no IPC with the running app"
  - "2026-09-23: separate screenforge-mcp binary (crates/sf-mcp) instead of an app subcommand"
  - "2026-09-23: xcap for capture, macOS only in v1"
---

**What**: repository skeleton. Cargo workspace with the Tauri app and `sf-core`,
React 19 + Tailwind v4 front, Vitest and `cargo test` suites, CI on macOS runners.

**Pitfalls**:
- `create-tauri-app` was run in a scratch folder and copied in (create tools
  refuse a non-empty folder).
- `[profile.release]` must live in the workspace root `Cargo.toml`: Cargo
  ignores profiles declared in member crates.
- `cargo test` on the Tauri crate does not need `dist/` in debug builds.
