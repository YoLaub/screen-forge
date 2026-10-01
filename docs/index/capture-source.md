---
id: okf-038
feature: capture-source
branch: feature/capture-source
status: done
issue: "#16 [RD-16]"
files:
  - crates/sf-core/src/node.rs (Node.source, Node.captured_at)
  - crates/sf-mcp/src/server.rs (snapshot description mentions them)
  - src/canvas/nodeRecord.ts (sfSource, sfCapturedAt, source / captured_at in the record)
  - src/canvas/CanvasView.tsx (set on window capture, shortcut, paste, drop; inherited by cut pieces)
  - src/canvas/NodeInspector.tsx (Source, Size, Captured), src/dates.ts (dayTimeLabel)
tests:
  - crates/sf-core/src/node.rs
  - src/canvas/nodeRecord.test.ts, src/canvas/NodeInspector.test.tsx, src/dates.test.ts, src/App.test.tsx
decisions:
  - "2026-10-01: a window capture (picker or Cmd+Shift+X) records the app's name as `source`; a pasted or dropped image records no app, because it has none, and the inspector says 'Pasted or dropped image'"
  - "2026-10-01: every capture made in the app records `captured_at` (when it joined the canvas); for paste and drop this is when it was pasted, which the issue left empty. The time is stored as ISO 8601 UTC, readable by the agent as is"
  - "2026-10-01: a piece cut from a capture, and copies of it, keep the capture's source and time. A merged image (Merge layers) has neither: it mixes several"
  - "2026-10-01: canvases saved before this have neither field; the inspector then shows only Size, and nothing is invented"
  - "2026-10-01: the snapshot description now tells the agent captures carry the source app and capture time (spec §7 extension)"
---

**What**: captures say which app they come from and when. Verified in the browser
E2E: window picker (Safari), global shortcut event (Figma), a pasted image (time only),
a cut piece and its duplicate (inherit), an old canvas without the fields (Size only,
no error). The real rebuilt `screenforge-mcp` returns `source` and `captured_at` in
`get_node_detail` and `get_canvas_snapshot`.

**Pitfall found by the E2E**: a harness returning `null` for a command it does not know
(`recent_projects`) crashed the home screen on `null.slice` and blanked the app. The list
now treats anything that is not a list as empty, with a test.
