---
id: okf-033
feature: connect-ai
branch: feature/connect-ai
status: done
issue: "#12 [RD-12]"
files:
  - src/AgentSetup.tsx (dialog: header, MCP line, client cards, last-read footer)
  - src/agentCards.ts (cardView: state, label, tone, button, message of one client)
  - src/App.tsx (results of the last attempts, project passed to the dialog)
tests:
  - src/agentCards.test.ts, src/AgentSetup.test.tsx, src/App.test.tsx
decisions:
  - "2026-09-30: the MCP line says what is true: 'MCP server ready' with the project's .screenforge folder when the binary is found, 'MCP server not found' with the reason otherwise. 'Running' (mockup) would be false: the server only runs inside an agent session"
  - "2026-10-01: each card derives from what the machine reports (agent_status) plus the result of the last attempt in this dialog: Not installed, Not connected, Connecting…, Connected, Points to another server, Connection failed"
  - "2026-10-01: teal buttons mean something needs doing (Connect, Update, Retry); Reconnect is a quiet outline; any disabled button is dimmed"
  - "2026-10-01: the restart hint after connecting keeps the app's existing, more precise wording ('Connected for every project. Restart running Claude Code sessions to use it.'); it shows only right after connecting, not every time the dialog opens"
  - "2026-10-01: the footer reads 'No agent has read this canvas yet.' until reads are recorded (#14), which will pass `lastRead`"
---

**What**: the redesigned Connect AI dialog. Verified in the browser E2E (light and
dark): Connected next to Points to another server, Update showing Connecting… with
the other card blocked then the Desktop restart hint, a failed attempt with its
reason and Retry, Escape closing, a missing MCP server and an uninstalled client.
