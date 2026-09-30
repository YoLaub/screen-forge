import type { WindowInfo } from "./WindowPicker";

export interface WindowGroup {
  app: string;
  items: { window: WindowInfo; /** Position in the picker's keyboard order. */ index: number }[];
}

/**
 * Windows matching `query` (on "app — title", ignoring case), grouped by app in
 * order of first appearance. `flat` lists them in display order, so an index into
 * it is what the arrow keys move through.
 */
export function groupWindows(windows: WindowInfo[], query: string): { groups: WindowGroup[]; flat: WindowInfo[] } {
  const needle = query.trim().toLowerCase();
  const matching = windows.filter((w) => `${w.app_name} ${w.title}`.toLowerCase().includes(needle));
  const apps = [...new Set(matching.map((w) => w.app_name))];
  const flat = apps.flatMap((app) => matching.filter((w) => w.app_name === app));
  const groups = apps.map((app) => ({
    app,
    items: flat.filter((w) => w.app_name === app).map((window) => ({ window, index: flat.indexOf(window) })),
  }));
  return { groups, flat };
}

/** Active row after an arrow key: one step, stopping at both ends. */
export function moveActive(index: number, count: number, delta: 1 | -1): number {
  return Math.max(0, Math.min(count - 1, index + delta));
}

export function sizeLabel(w: { width: number; height: number }): string {
  return `${w.width} × ${w.height}`;
}
