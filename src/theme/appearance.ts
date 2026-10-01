import { type Theme, cssVariables, themeFor } from "./tokens";

export type { Theme };

// Follows the macOS appearance (decision 2026-09-30: no manual switch).
const query = window.matchMedia("(prefers-color-scheme: dark)");

export function currentTheme(): Theme {
  return themeFor(query.matches);
}

/** Calls `listener` with the new theme when the macOS appearance changes; returns the unsubscribe. */
export function onThemeChange(listener: (theme: Theme) => void): () => void {
  const handler = () => listener(currentTheme());
  query.addEventListener("change", handler);
  return () => query.removeEventListener("change", handler);
}

/** Writes the tokens on the document and keeps them in sync with the appearance. */
export function applyTheme(): void {
  const write = () => {
    const root = document.documentElement;
    root.style.cssText = cssVariables(currentTheme());
    // Native controls (select, range, scrollbars) follow the theme too.
    root.style.colorScheme = query.matches ? "dark" : "light";
  };
  write();
  query.addEventListener("change", write);
}
