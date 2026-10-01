---
id: okf-034
feature: home
branch: feature/home
status: done
issue: "#13 [RD-13]"
files:
  - src/Home.tsx (logo, title, Open a folder card, Opening card)
  - src/Logo.tsx (glow), src/theme/tokens.ts (BRAND.glow)
  - src/App.tsx (Home when no project, Opening overlay until the canvas loads, Cmd+O)
  - src/canvas/CanvasView.tsx (onLoaded)
tests:
  - src/Home.test.tsx, src/App.test.tsx
decisions:
  - "2026-10-01: opening a project mounts the canvas under a full-window Home showing 'Opening <name>…'; the canvas reports onLoaded (success or failure) and the overlay lifts. On a failed load the sticky toast shows and the empty-canvas message stays hidden"
  - "2026-10-01: the mockup's element count ('Loading 8 elements…') is left out: the state lasts a fraction of a second and an exact count needs a new Rust command. The card says 'Loading the canvas from .screenforge/'"
  - "2026-10-01: 'or drop one here' is left out until folder drop exists (#17), as is the Recent list (#15)"
  - "2026-10-01: Cmd+O opens the folder picker from the home screen and the workspace; a plain O stays the Ellipse tool"
  - "2026-10-01: a canvas disposed before its load ended (development double mount) does not report loaded"
---

**What**: the redesigned home screen and its Opening state. Verified in the browser
E2E (light and dark): idle card with ⌘O, Cmd+O from home and workspace, Opening card
over the whole window (title bar included) until the canvas loaded, a failed load
lifting it onto the toast.
