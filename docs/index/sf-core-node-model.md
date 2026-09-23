---
id: okf-002
feature: sf-core-node-model
branch: feature/sf-core-node-model
status: done
files:
  - crates/sf-core/src/node.rs (Node, Connection, id validation)
  - crates/sf-core/src/store.rs (write/read/list nodes, dependencies)
tests:
  - crates/sf-core/src/node.rs (spec §7 field names, JSON round-trip, id rules)
  - crates/sf-core/src/store.rs (filesystem, on real temp folders)
decisions:
  - "2026-09-23: node.json holds metadata only; SVG and PNG live as sibling files (the MCP layer assembles the §7 payload)"
  - "2026-09-23: node ids restricted to [A-Za-z0-9_-]{1,128} because they become folder names and arrive from MCP input"
  - "2026-09-23: writes go to node.json.tmp then rename, so screenforge-mcp never reads a half-written file"
  - "2026-09-23: ProjectNotFound (no .screenforge/) is distinct from NodeNotFound and from an empty node list"
---

**What**: the node model and its storage under `.screenforge/nodes/<id>/node.json`.
`list_nodes` returns nodes sorted by id, `node_dependencies` returns the upstream
links (other nodes pointing here) and the downstream links (this node's connections).

**Pitfalls**:
- A node folder can exist before its `node.json` is renamed into place, so
  `list_nodes` skips folders that have no `node.json` instead of failing.
