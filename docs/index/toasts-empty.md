---
id: okf-031
feature: toasts-empty
branch: feature/toasts-empty
status: done
issue: "#10 [RD-10]"
files:
  - src/toast/model.ts (failureToast, pushToast, dismissToast, delays)
  - src/toast/useToasts.ts (stable push and dismiss, automatic dismissal)
  - src/toast/Toasts.tsx (bottom-center stack)
  - src/canvas/EmptyCanvas.tsx (empty canvas state)
  - src/canvas/CanvasView.tsx (every status message now a toast, load state, disposed guard)
tests:
  - src/toast/model.test.ts, src/toast/useToasts.test.ts, src/toast/Toasts.test.tsx, src/canvas/EmptyCanvas.test.tsx
decisions:
  - "2026-09-30: the grey status line is gone. Failures and gestures that did nothing are warning toasts (title = the action, message = the reason); completed actions (Exported, Captured) are green toasts, which the mockup does not show"
  - "2026-09-30: warnings stay 8 s, confirmations 4 s, at most 3 at once; an identical toast replaces the previous one, so a failing autosave shows one toast"
  - "2026-09-30: 'Load failed, saving is off' is sticky: saving is blocked until the project is reopened"
  - "2026-09-30: the empty-canvas message shows only once the saved canvas has loaded, never after a failed load; clicks fall through around its buttons, so drawing works on an empty canvas"
  - "2026-09-30: a load failure from a canvas that was already disposed is ignored (see pitfall)"
---

**What**: toasts for every message and the empty-canvas state. Verified in the
browser E2E (light and dark): empty state hidden while loading, shown after,
gone on the first shape; warning, confirmation, three failing saves giving one
toast, sticky load failure still there after 9 s.

**Pitfalls**:
- In development React mounts the canvas twice; the first one is disposed while
  its saved canvas is still loading, and `loadFromJSON` then fails with "Cannot
  read properties of undefined (reading 'clearRect')". As a status-line message
  it was almost invisible; as a sticky toast it would be a false alarm.
  Reproduced 4 times out of 4 without the `disposed` guard, 0 of 4 with it.
