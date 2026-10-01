---
id: okf-028
feature: inspector
branch: feature/inspector
status: done
issue: "#7 [RD-07]"
files:
  - src/canvas/NodeInspector.tsx (header, instructions block, link cards, sections)
  - src/canvas/StyleSection.tsx (segments, text color, stroke + W, opacity %)
  - src/canvas/layers.ts (typeLabel)
  - src/canvas/CanvasView.tsx (type, pin, capture size, frame child count, link target types)
tests:
  - src/canvas/NodeInspector.test.tsx, src/canvas/StyleSection.test.tsx, src/canvas/layers.test.ts
decisions:
  - "2026-09-30: instructions come right after the name, in a magenta block with the pin number, the 'Sent with…' hint and ⌘↵, which leaves the field keeping the text"
  - "2026-09-30: links are cards (target, target type, remove, Trigger, Payload); link targets read '<name> · <Type>'"
  - "2026-09-30: Style is collapsible; Fill and Weight are segmented controls; a text gets one Color and no stroke controls (mockup)"
  - "2026-09-30: captures show their pixel size and the cut hint; Source and Captured wait for capture metadata (#16)"
  - "2026-09-30: afterEdit refreshes the layers before the selection, so the inspector reads the current pin number"
---

**What**: the redesigned inspector. Verified in the browser E2E (light and dark):
rectangle with instructions, pin badge and a link card; text with one color;
capture with its size; frame with its element count.
