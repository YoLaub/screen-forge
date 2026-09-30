---
id: okf-022
feature: theme-tokens
branch: feature/theme-tokens
status: done
issue: "#1 [RD-01]"
files:
  - src/theme/tokens.ts (light and dark tokens, the only UI colors)
  - src/theme/appearance.ts (writes the tokens on :root, follows the macOS appearance)
  - src/theme/colorGuard.ts (finds palette classes and color literals)
  - src/index.css (Tailwind token names, bundled Geist fonts)
  - src/canvas/drawingDefaults.ts (content colors: what the user draws)
  - src/canvas/CanvasView.tsx (canvas chrome from the tokens, fixed render background)
tests:
  - src/theme/tokens.test.ts, src/theme/colorGuard.test.ts (repo guard with probes)
decisions:
  - "2026-09-30: tokens come from the mockup; teal (acc) for tools and selection, magenta (ag) only for what the agent reads; `scrim` added for dialog veils"
  - "2026-09-30: one source, tokens.ts: CSS reads custom properties written at startup, the Fabric canvas reads the same object"
  - "2026-09-30: the theme follows the macOS appearance live, no manual switch"
  - "2026-09-30: drawing colors are content, not theme: they are saved and sent to the agent, so they live in drawingDefaults.ts and do not change with the appearance"
  - "2026-09-30: images for the agent and exports render on a fixed #f5f5f5 background whatever the theme"
  - "2026-09-30: Geist and Geist Mono bundled through @fontsource (SIL OFL), no Google Fonts request"
---

**What**: light and dark theme tokens used by every screen, with bundled fonts, and
a repo guard that refuses colors outside the theme and the drawing defaults.
Verified in the browser E2E: light and dark (switched live), dialogs and context
menu in dark, agent canvas image still on #f5f5f5 in dark, fonts served locally.

**Pitfalls**:
- jsdom has no `window.matchMedia`: stubbed in `src/test-setup.ts`.
- The canvas background is part of the images sent to the agent: switching it
  with the theme would change what the agent sees. `renderRegion` sets its own.
