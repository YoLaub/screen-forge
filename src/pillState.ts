import type { WindowInfo } from "./canvas/WindowPicker";
import type { AgentPill } from "./titleBarState";

export type PillMode = "collapsed" | "expanded" | "captured";
export type PillEvent = "enter" | "leave" | "captured" | "dismiss";

/** What the pill shows next: a tab, the action bar on hover, or the card after a capture. */
export function nextMode(mode: PillMode, event: PillEvent): PillMode {
  if (event === "captured") return "captured";
  if (mode === "captured") return event === "dismiss" ? "collapsed" : "captured";
  if (event === "enter") return "expanded";
  if (event === "leave") return "collapsed";
  return mode;
}

/** The agent line of the pill: who is connected and how much there is to read. */
export function agentTooltip(pill: AgentPill, instructions: number | null): string {
  if (!pill.connected) return "No agent connected";
  if (instructions === null) return `${pill.client} connected`;
  return `${pill.client} connected · ${instructions} ${instructions === 1 ? "instruction" : "instructions"} on canvas`;
}

/** The line under "Captured to canvas": app, then the window's title when it has one. */
export function captureLines(window: WindowInfo): string {
  return window.title ? `${window.app_name} — ${window.title}` : window.app_name;
}

/** The capture card leaves by itself only when nobody touched it. */
export function shouldAutoDismiss(card: { text: string; hovered: boolean; focused: boolean }): boolean {
  return card.text.trim() === "" && !card.hovered && !card.focused;
}
