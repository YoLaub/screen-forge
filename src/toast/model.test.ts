import { describe, expect, it } from "vitest";
import { MAX_TOASTS, type Toast, dismissToast, failureToast, pushToast } from "./model";

describe("failureToast", () => {
  it("turns an error into a warning with the reason as its message", () => {
    expect(failureToast("Export failed", new Error("disk full"))).toEqual({ kind: "warn", title: "Export failed", message: "disk full" });
  });

  it("accepts the plain strings Tauri commands reject with, and strips 'Error: '", () => {
    expect(failureToast("Capture failed", "permission denied").message).toBe("permission denied");
    expect(failureToast("Capture failed", "Error: no window").message).toBe("no window");
  });

  it("can be sticky, for failures that do not go away by themselves", () => {
    expect(failureToast("Load failed", "bad json", true).sticky).toBe(true);
  });
});

describe("pushToast", () => {
  const spec = (title: string, message = "") => ({ kind: "warn" as const, title, message });

  it("appends a toast with its id", () => {
    expect(pushToast([], spec("A"), 1)).toEqual([{ ...spec("A"), id: 1 }]);
  });

  it("replaces an identical toast instead of stacking it (repeated save failures)", () => {
    const list = pushToast(pushToast([], spec("Save failed", "x"), 1), spec("Save failed", "x"), 2);
    expect(list).toEqual([{ ...spec("Save failed", "x"), id: 2 }]);
  });

  it("keeps different messages side by side, and at most MAX_TOASTS, newest last", () => {
    let list: Toast[] = [];
    for (let i = 1; i <= MAX_TOASTS + 2; i++) list = pushToast(list, spec(`T${i}`), i);
    expect(list.map((t) => t.title)).toEqual(["T3", "T4", "T5"]);
  });
});

describe("dismissToast", () => {
  it("removes one toast by id", () => {
    const list = pushToast(pushToast([], { kind: "ok", title: "A" }, 1), { kind: "ok", title: "B" }, 2);
    expect(dismissToast(list, 1).map((t) => t.title)).toEqual(["B"]);
  });
});
