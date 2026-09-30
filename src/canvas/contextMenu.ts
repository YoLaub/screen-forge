import type { Box, Pt } from "./geometry";

/** What a right-click acts on: the selection, or the element under the pointer. */
export interface MenuTargets {
  count: number;
  allLocked: boolean;
}

export type MenuAction = "copy" | "paste" | "duplicate" | "lock" | "forward" | "backward";

export interface MenuItem {
  id: MenuAction;
  label: string;
  shortcut?: string;
  enabled: boolean;
}

export function menuItems(targets: MenuTargets, hasClipboard: boolean): (MenuItem | "separator")[] {
  const any = targets.count > 0;
  const one = targets.count === 1;
  return [
    { id: "copy", label: "Copy", shortcut: "⌘C", enabled: any },
    { id: "paste", label: "Paste", shortcut: "⌘V", enabled: hasClipboard },
    { id: "duplicate", label: "Duplicate", shortcut: "⌘D", enabled: any },
    "separator",
    { id: "lock", label: any && targets.allLocked ? "Unlock" : "Lock", enabled: any },
    "separator",
    { id: "forward", label: "Bring forward", shortcut: "⌘]", enabled: one },
    { id: "backward", label: "Send backward", shortcut: "⌘[", enabled: one },
  ];
}

/** Move applied to pasted elements: centered on `at`, else 20 px further per successive paste. */
export function pasteDelta(copied: Box, pasteCount: number, at?: Pt): Pt {
  if (at) return { x: at.x - (copied.left + copied.width / 2), y: at.y - (copied.top + copied.height / 2) };
  return { x: 20 * pasteCount, y: 20 * pasteCount };
}
