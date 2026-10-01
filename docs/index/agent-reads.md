---
id: okf-036
feature: agent-reads
branch: feature/agent-reads
status: done
issue: "#14 [RD-14]"
files:
  - crates/sf-core/src/reads.rs (AgentRead, write_last_read, read_last_read, now_ms)
  - crates/sf-mcp/src/tools.rs (read summaries, record_read), crates/sf-mcp/src/server.rs (records after each successful call)
  - src-tauri/src/project.rs, src-tauri/src/lib.rs (last_agent_read command)
  - src/agentRead.ts (agent names, "5 min ago", the footer line), src/useLastRead.ts (polling), src/useNow.ts
  - src/titleBarState.ts, src/TitleBar.tsx (pill note), src/App.tsx (Connect AI footer)
tests:
  - crates/sf-core/src/reads.rs, crates/sf-mcp/src/server.rs, src-tauri/src/project.rs
  - src/agentRead.test.ts, src/useLastRead.test.ts, src/titleBarState.test.ts, src/TitleBar.test.tsx, src/App.test.tsx
decisions:
  - "2026-10-01: only the latest read is kept, in .screenforge/last_read.json replaced atomically (one temp file per process, since Claude Code and Claude Desktop can both be reading). The issue said 'append'; nothing reads the history, and a log would grow without bound"
  - "2026-10-01: a read is recorded after each SUCCESSFUL call of the three tools, with the tool, the agent's MCP client name, the nodes it showed and how many have instructions (snapshot: all nodes; detail and dependencies: the one node)"
  - "2026-10-01: recording is best effort: if the file cannot be written the agent's answer is unchanged and the cause goes to stderr (stdout carries the protocol). It never creates the project folder"
  - "2026-10-01: the app polls every 3 s while the window is visible, and on focus. A file watcher was not worth a dependency for one tiny file; the polling keeps the same object when nothing changed so the canvas is not redrawn"
  - "2026-10-01: the title bar note is 'read the canvas · just now / 5 min ago / 09:05 / yesterday / 28 Sep' and moves on by itself every 30 s; the pill names the agent that read when it is one of the connected clients"
  - "2026-10-01: Claude Code and Claude Desktop are recognised from the MCP client name ('claude-code'; anything else containing 'claude', e.g. 'claude-ai', is Claude Desktop). The 'claude-ai' spelling is from memory, not checked: any other name is shown as the client gave it"
  - "2026-10-01: the MCP server is no longer strictly read-only; CLAUDE.md and the crate docs now say so (it never changes nodes or the canvas)"
---

**What**: the app shows when an agent last read the canvas. Verified end to end
with the real rebuilt `screenforge-mcp` driven over stdio on a temp project:
3 nodes, 2 with instructions, recorded as read by `claude-code`; the UI (pointed at
that real file through a small bridge standing in for the Tauri command) changed
from "connected" to "read the canvas · just now" about 1 s after the write
(1018 ms measured with a MutationObserver against the file's own timestamp), and
Connect AI showed "Claude Code last read the canvas at 16:56 · 3 elements, 2 with
instructions". Not run in the packaged app.

**Pitfalls**:
- Restart Claude Code / Claude Desktop sessions after a rebuild: a running session
  keeps the old `screenforge-mcp` and records nothing.
- `ClientConfig` and `()` are different client types in rmcp tests: build the named
  client from a `ClientConfig` in both branches.
