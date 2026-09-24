import { describe, expect, it } from "vitest";
import { createHistory } from "./history";

describe("createHistory", () => {
  it("undoes back to earlier states and redoes forward", () => {
    const h = createHistory<string>(10);
    h.record("a");
    h.record("b");
    h.record("c");
    expect(h.undo()).toBe("b");
    expect(h.undo()).toBe("a");
    expect(h.undo()).toBeNull();
    expect(h.redo()).toBe("b");
    expect(h.redo()).toBe("c");
    expect(h.redo()).toBeNull();
  });

  it("drops the redo branch when a new state is recorded after an undo", () => {
    const h = createHistory<string>(10);
    h.record("a");
    h.record("b");
    h.undo();
    h.record("x");
    expect(h.redo()).toBeNull();
    expect(h.undo()).toBe("a");
  });

  it("ignores a state identical to the current one", () => {
    const h = createHistory<string>(10);
    h.record("a");
    h.record("a");
    h.record("b");
    expect(h.undo()).toBe("a");
    expect(h.undo()).toBeNull();
  });

  it("forgets the oldest states beyond the limit", () => {
    const h = createHistory<string>(3);
    ["a", "b", "c", "d"].forEach((s) => h.record(s));
    expect(h.undo()).toBe("c");
    expect(h.undo()).toBe("b");
    expect(h.undo()).toBeNull();
  });

  it("reports what can be undone or redone", () => {
    const h = createHistory<string>(10);
    h.record("a");
    expect(h.canUndo()).toBe(false);
    h.record("b");
    expect(h.canUndo()).toBe(true);
    expect(h.canRedo()).toBe(false);
    h.undo();
    expect(h.canRedo()).toBe(true);
  });
});
