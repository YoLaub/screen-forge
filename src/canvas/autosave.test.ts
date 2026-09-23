import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAutosave } from "./autosave";

describe("createAutosave", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("saves once, delay after the last change", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const autosave = createAutosave(save, 500);
    autosave.schedule();
    await vi.advanceTimersByTimeAsync(300);
    autosave.schedule();
    await vi.advanceTimersByTimeAsync(499);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("saves again when a change lands during a save", async () => {
    let finish!: () => void;
    const save = vi
      .fn()
      .mockImplementationOnce(() => new Promise<void>((r) => (finish = r)))
      .mockResolvedValue(undefined);
    const autosave = createAutosave(save, 500);
    autosave.schedule();
    await vi.advanceTimersByTimeAsync(500);
    autosave.schedule();
    await vi.advanceTimersByTimeAsync(500);
    expect(save).toHaveBeenCalledTimes(1);
    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("reports save errors instead of throwing", async () => {
    const onError = vi.fn();
    const autosave = createAutosave(() => Promise.reject(new Error("disk full")), 500, onError);
    autosave.schedule();
    await vi.advanceTimersByTimeAsync(500);
    expect(onError).toHaveBeenCalledWith(new Error("disk full"));
  });
});
