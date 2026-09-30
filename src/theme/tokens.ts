/**
 * UI color tokens of the redesign (design/…/ScreenForge Redesign.dc.html), light and
 * dark. Teal (`acc`) is for tools and selection; magenta (`ag`) only for what the agent
 * reads. The only place UI colors are written: CSS reads them as custom properties,
 * the Fabric canvas reads them directly.
 */
const light = {
  bg: "#f2f3f5",
  panel: "#ffffff",
  panel2: "#f5f6f8",
  hover: "rgba(17,20,32,.05)",
  line: "rgba(17,20,32,.09)",
  line2: "rgba(17,20,32,.16)",
  tx: "#14161c",
  tx2: "#555b69",
  tx3: "#868b98",
  canvas: "#e6e8ec",
  dot: "rgba(17,20,32,.13)",
  acc: "#0a7f97",
  accTx: "#ffffff",
  accSoft: "rgba(10,127,151,.12)",
  sel: "#0ea5c0",
  ag: "#a92fbb",
  agTx: "#ffffff",
  agSoft: "rgba(169,47,187,.06)",
  agLine: "rgba(169,47,187,.24)",
  warn: "#c2530f",
  warnSoft: "rgba(232,100,27,.12)",
  ok: "#1b8a4c",
  okSoft: "rgba(27,138,76,.14)",
  link: "#8a8f9c",
  shadow: "0 1px 2px rgba(17,20,32,.06),0 6px 20px rgba(17,20,32,.08)",
  // Not in the mockup: the veil behind dialogs.
  scrim: "rgba(17,20,32,.28)",
};

export type Theme = typeof light;

const dark: Theme = {
  bg: "#111319",
  panel: "#181b22",
  panel2: "#1f222b",
  hover: "rgba(255,255,255,.05)",
  line: "rgba(255,255,255,.07)",
  line2: "rgba(255,255,255,.13)",
  tx: "#e9ebf1",
  tx2: "#a4a9b6",
  tx3: "#737988",
  canvas: "#0b0c10",
  dot: "rgba(255,255,255,.075)",
  acc: "#2fc7df",
  accTx: "#052a31",
  accSoft: "rgba(47,199,223,.14)",
  sel: "#2fc7df",
  ag: "#e279f0",
  agTx: "#2a0a30",
  agSoft: "rgba(226,121,240,.07)",
  agLine: "rgba(226,121,240,.3)",
  warn: "#ff9a5c",
  warnSoft: "rgba(255,154,92,.14)",
  ok: "#45d98a",
  okSoft: "rgba(69,217,138,.14)",
  link: "#6d7382",
  shadow: "0 1px 2px rgba(0,0,0,.4),0 8px 28px rgba(0,0,0,.45)",
  scrim: "rgba(0,0,0,.5)",
};

export const THEMES = { light, dark };

/** The theme for the macOS appearance (decision 2026-09-30: no manual switch). */
export function themeFor(prefersDark: boolean): Theme {
  return prefersDark ? THEMES.dark : THEMES.light;
}

/** CSS custom properties for `theme`, e.g. `--acc-soft: …;`. */
export function cssVariables(theme: Partial<Theme>): string {
  return Object.entries(theme)
    .map(([name, value]) => `--${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}: ${value};`)
    .join(" ");
}
