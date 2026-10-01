---
id: okf-037
feature: recent-projects
branch: feature/recent-projects
status: done
issue: "#15 [RD-15]"
files:
  - crates/sf-core/src/app_state.rs (RecentProject, read_recent_projects, record_opened_project, display_path, project_name)
  - src-tauri/src/project.rs, src-tauri/src/lib.rs (recent_projects command; set_last_project now records)
  - src/Home.tsx (Recent list), src/recent.ts, src/dates.ts (dayLabel, shared with agentRead)
  - src/App.tsx (loads and refreshes the list, openProject)
tests:
  - crates/sf-core/src/app_state.rs, src-tauri/src/project.rs
  - src/Home.test.tsx, src/App.test.tsx, src/dates.test.ts, src/recent.test.ts
decisions:
  - "2026-10-01: the list lives in a new recent_projects.json (newest first, 10 kept, vanished folders dropped on read and forgotten on the next open). The last_project file stays and is still written on every open: screenforge-mcp, including older binaries already registered with Claude, reads it"
  - "2026-10-01: migration: without a list file, the single last project becomes the first entry, dated by last_project's own modification time. A corrupt list falls back the same way"
  - "2026-10-01: the same folder spelled with a trailing slash is one project (Path comparison)"
  - "2026-10-01: Rust returns name and a ~ display path, so the front has no path logic; the home screen shows the newest 5"
  - "2026-10-01: during the Opening card the list stays but cannot be clicked; with no recent project the Recent section is absent, and an unreadable list is an empty one"
---

**What**: the home screen's Recent list: name, path with `~`, and Today / Yesterday /
12 Sep; a click opens the project. Verified in the browser E2E (light and dark): the
list, a long path truncated, opening a recent project (remembered, moved first, rows
disabled while opening). Migration also checked on a COPY of the owner's real config
folder: the Okyr project became the first recent entry.

**Notes**: the Rust to front contract (name, display, path, opened_ms) is pinned by a
Rust test on the JSON and by the TypeScript type; the Tauri command itself was not
run in the packaged app.
