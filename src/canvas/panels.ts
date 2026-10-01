/** Which side panels are folded away. */
export interface PanelsState {
  layers: boolean;
  inspector: boolean;
}

export const PANELS_KEY = "screenforge.panels";
const OPEN: PanelsState = { layers: false, inspector: false };

export function togglePanel(state: PanelsState, panel: keyof PanelsState): PanelsState {
  return { ...state, [panel]: !state[panel] };
}

/** Cmd+\ : fold both panels to see the canvas alone, or bring both back. */
export function toggleAll(state: PanelsState): PanelsState {
  const fold = !(state.layers && state.inspector);
  return { layers: fold, inspector: fold };
}

type Reader = Pick<Storage, "getItem">;
type Writer = Pick<Storage, "setItem">;

/** Saved state, or both panels open: storage can be empty, corrupt or unavailable. */
export function readPanels(storage: Reader): PanelsState {
  try {
    const saved = JSON.parse(storage.getItem(PANELS_KEY) ?? "null");
    if (typeof saved?.layers === "boolean" && typeof saved?.inspector === "boolean") {
      return { layers: saved.layers, inspector: saved.inspector };
    }
  } catch {
    // Nothing usable saved: fall through to the default.
  }
  return OPEN;
}

export function writePanels(storage: Writer, state: PanelsState): void {
  try {
    storage.setItem(PANELS_KEY, JSON.stringify(state));
  } catch {
    // The choice just is not remembered.
  }
}

/** Shift+Cmd+H. A letter key: it is the same on every keyboard layout, unlike a backslash. */
export function isTogglePanelsKey(e: Pick<KeyboardEvent, "key" | "metaKey" | "shiftKey" | "altKey" | "ctrlKey">): boolean {
  return e.metaKey && e.shiftKey && !e.altKey && !e.ctrlKey && e.key.toLowerCase() === "h";
}

/** `localStorage`, or a storage that remembers nothing where it cannot be reached (blocked site data). */
export function browserStorage(): Pick<Storage, "getItem" | "setItem"> {
  try {
    return window.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => {} };
  }
}
