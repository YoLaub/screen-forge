---
id: okf-020
feature: groups
branch: feature/groups
status: done
files:
  - src/canvas/groups.ts (group ids, selection growth, layer rows)
  - src/canvas/nodeRecord.ts (sfGroup, group in the node record)
  - src/canvas/duplicate.ts (copies of a group make a new group)
  - src/canvas/contextMenu.ts (Group, Ungroup)
  - src/canvas/CanvasView.tsx (Cmd+G, Shift+Cmd+G, selection, layers ops)
  - crates/sf-core/src/node.rs (Node.group)
tests:
  - src/canvas/groups.test.ts, src/canvas/duplicate.test.ts, src/canvas/nodeRecord.test.ts, src/canvas/contextMenu.test.ts, crates/sf-core/src/node.rs
decisions:
  - "2026-09-30: light groups: members stay separate nodes sharing sfGroup {id, name}; the agent sees `group` on each member"
  - "2026-09-30: a canvas click, box selection or Shift+click takes the whole group; the layers panel can select one member alone"
  - "2026-09-30: a group row sits where its topmost member is; rename, hide and lock on it apply to all members"
  - "2026-09-30: duplicating or pasting several members of a group makes a new group '<name> copy'; a lone copied member stays in its group"
  - "2026-09-30: groups are flat (grouping members of a group moves them to the new group)"
---

**What**: group and ungroup nodes (Cmd+G, Shift+Cmd+G, right-click menu).
Verified in the browser E2E: a click and drag on one member moves the group,
a member picked in the layers panel moves alone, Ungroup, duplicating a group,
`group` in the saved node records.

**Pitfalls**:
- Fabric caches the click target (`_targetInfo`) before `mouse:down:before`
  handlers run: after growing the selection there, reset that private cache or
  the drag keeps targeting the lone member and nothing moves.
