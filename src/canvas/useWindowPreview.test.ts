import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PREVIEW_CACHE, useWindowPreview } from "./useWindowPreview";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const settle = async (ms = 300) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

describe("useWindowPreview", () => {
  it("is idle without a window, loading right away, then ready with the capture", async () => {
    const capture = vi.fn().mockResolvedValue("PNG1");
    const { result, rerender } = renderHook(({ id }) => useWindowPreview(id, capture), { initialProps: { id: null as number | null } });
    expect(result.current.status).toBe("idle");
    rerender({ id: 1 });
    expect(result.current.status).toBe("loading");
    await settle();
    expect(result.current).toEqual({ status: "ready", png: "PNG1" });
    expect(capture).toHaveBeenCalledWith(1);
  });

  it("captures only the window it rests on: moving through the list is debounced", async () => {
    const capture = vi.fn().mockImplementation(async (id: number) => `PNG${id}`);
    const { result, rerender } = renderHook(({ id }) => useWindowPreview(id, capture), { initialProps: { id: 1 } });
    await settle(100);
    rerender({ id: 2 });
    await settle(100);
    rerender({ id: 3 });
    await settle();
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(3);
    expect(result.current).toEqual({ status: "ready", png: "PNG3" });
  });

  it("remembers captures: going back to a window does not capture it again", async () => {
    const capture = vi.fn().mockImplementation(async (id: number) => `PNG${id}`);
    const { result, rerender } = renderHook(({ id }) => useWindowPreview(id, capture), { initialProps: { id: 1 } });
    await settle();
    rerender({ id: 2 });
    await settle();
    rerender({ id: 1 });
    expect(result.current).toEqual({ status: "ready", png: "PNG1" });
    await settle();
    expect(capture).toHaveBeenCalledTimes(2);
  });

  it("ignores a capture that finishes after the user moved on", async () => {
    let finishFirst!: (png: string) => void;
    const capture = vi.fn().mockImplementation((id: number) => (id === 1 ? new Promise<string>((r) => (finishFirst = r)) : Promise.resolve("PNG2")));
    const { result, rerender } = renderHook(({ id }) => useWindowPreview(id, capture), { initialProps: { id: 1 } });
    await settle();
    rerender({ id: 2 });
    await settle();
    await act(async () => finishFirst("LATE1"));
    expect(result.current).toEqual({ status: "ready", png: "PNG2" });
  });

  it("reports a failed capture without throwing", async () => {
    const capture = vi.fn().mockRejectedValue("no access");
    const { result } = renderHook(() => useWindowPreview(1, capture));
    await settle();
    expect(result.current.status).toBe("failed");
  });

  it("keeps a bounded number of captures, dropping the oldest", async () => {
    const capture = vi.fn().mockImplementation(async (id: number) => `PNG${id}`);
    const { rerender } = renderHook(({ id }) => useWindowPreview(id, capture), { initialProps: { id: 0 } });
    await settle();
    for (let id = 1; id <= PREVIEW_CACHE; id++) {
      rerender({ id });
      await settle();
    }
    capture.mockClear();
    rerender({ id: 0 });
    await settle();
    expect(capture).toHaveBeenCalledWith(0);
  });
});
