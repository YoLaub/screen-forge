import { describe, expect, it } from "vitest";
import { type PanelsState, PANELS_KEY, browserStorage, isTogglePanelsKey, readPanels, toggleAll, togglePanel, writePanels } from "./panels";

const open: PanelsState = { layers: false, inspector: false };

describe("togglePanel", () => {
  it("folds and unfolds one panel, leaving the other alone", () => {
    expect(togglePanel(open, "layers")).toEqual({ layers: true, inspector: false });
    expect(togglePanel({ layers: true, inspector: false }, "layers")).toEqual(open);
    expect(togglePanel(open, "inspector")).toEqual({ layers: false, inspector: true });
  });
});

describe("toggleAll", () => {
  it("folds both when any is open, and unfolds both when both are folded", () => {
    expect(toggleAll(open)).toEqual({ layers: true, inspector: true });
    expect(toggleAll({ layers: true, inspector: false })).toEqual({ layers: true, inspector: true });
    expect(toggleAll({ layers: true, inspector: true })).toEqual(open);
  });
});

describe("readPanels / writePanels", () => {
  const storage = (initial: Record<string, string> = {}) => {
    const data = { ...initial };
    return { data, getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v) };
  };

  it("starts with both panels open when nothing was saved", () => {
    expect(readPanels(storage())).toEqual(open);
  });

  it("remembers what was saved", () => {
    const s = storage();
    writePanels(s, { layers: true, inspector: false });
    expect(s.data[PANELS_KEY]).toBe('{"layers":true,"inspector":false}');
    expect(readPanels(s)).toEqual({ layers: true, inspector: false });
  });

  it("ignores a corrupt or unexpected value", () => {
    expect(readPanels(storage({ [PANELS_KEY]: "not json" }))).toEqual(open);
    expect(readPanels(storage({ [PANELS_KEY]: '{"layers":"yes"}' }))).toEqual(open);
    expect(readPanels(storage({ [PANELS_KEY]: "null" }))).toEqual(open);
  });

  it("still works when storage is unavailable (private window, blocked data)", () => {
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(readPanels(broken)).toEqual(open);
    expect(() => writePanels(broken, open)).not.toThrow();
  });
});

describe("isTogglePanelsKey", () => {
  const key = (k: string, extra: Partial<KeyboardEvent> = {}) =>
    ({ key: k, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...extra }) as KeyboardEvent;

  it("is Shift+Cmd+H, a letter, so it is the same on QWERTY and AZERTY", () => {
    expect(isTogglePanelsKey(key("h", { metaKey: true, shiftKey: true }))).toBe(true);
    expect(isTogglePanelsKey(key("H", { metaKey: true, shiftKey: true }))).toBe(true);
  });

  it("ignores H alone and other combinations (Cmd+H hides the app)", () => {
    expect(isTogglePanelsKey(key("h"))).toBe(false);
    expect(isTogglePanelsKey(key("h", { metaKey: true }))).toBe(false);
    expect(isTogglePanelsKey(key("h", { metaKey: true, shiftKey: true, altKey: true }))).toBe(false);
    expect(isTogglePanelsKey(key("g", { metaKey: true, shiftKey: true }))).toBe(false);
  });
});

describe("browserStorage", () => {
  it("falls back to a storage that remembers nothing when localStorage cannot be reached", () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage")!;
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("denied");
      },
    });
    try {
      const storage = browserStorage();
      expect(() => storage.setItem("k", "v")).not.toThrow();
      expect(storage.getItem("k")).toBeNull();
    } finally {
      Object.defineProperty(window, "localStorage", original);
    }
  });
});
