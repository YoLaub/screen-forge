---
id: okf-003
feature: sf-mcp
branch: feature/sf-mcp
status: done
files:
  - crates/sf-mcp/src/tools.rs (pure tool logic over sf-core)
  - crates/sf-mcp/src/server.rs (thin rmcp wrappers)
  - crates/sf-mcp/src/main.rs (stdio entry point, project = current dir)
  - crates/sf-core/src/store.rs (SVG_FILE_NAME, PNG_FILE_NAME)
tests:
  - crates/sf-mcp/src/tools.rs (payload shapes, error messages)
  - crates/sf-mcp/src/server.rs (in-process rmcp client over a duplex pipe)
decisions:
  - "2026-09-23: PNG sent as an MCP image block, not base64 inside the JSON (the model sees an image; the JSON stays small)"
  - "2026-09-23: colors_detected moves under visual_context in get_node_detail to match spec §7; node.json keeps it top-level"
  - "2026-09-23: read and parse failures return one generic message; details go to stderr (stdout carries the protocol)"
---

**What**: `screenforge-mcp` binary, rmcp 3.4 over stdio, with 3 read-only tools:
`get_canvas_snapshot`, `get_node_detail` (JSON + PNG image block) and
`get_node_dependencies`. E2E: raw JSON-RPC against the binary, then `claude -p`
with `--mcp-config` on a fixture project. Claude read the instruction, the
upstream link and described the PNG.

**Pitfalls**:
- A `todo!()` or panic in an rmcp tool handler never answers: the client waits
  forever. Test calls are wrapped in a 10 s timeout.
- `#[tool_handler]` without `router = self.tool_router` rebuilds the router on
  every call and leaves the field unused (compiler warning).
