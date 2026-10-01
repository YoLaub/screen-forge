import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentRead } from "./agentRead";
import { useLastRead } from "./useLastRead";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const read = (at_ms: number): AgentRead => ({ at_ms, tool: "get_canvas_snapshot", client: "claude-code", nodes: 8, with_instructions: 4 });
const settle = async (ms = 0) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

describe("useLastRead", () => {
  it("shows nothing until an agent has read, then the read", async () => {
    const fetchRead = vi.fn().mockResolvedValue(null);
    const { result } = renderHook(() => useLastRead("/work/app", fetchRead));
    await settle();
    expect(result.current).toBeNull();
    fetchRead.mockResolvedValue(read(1));
    await settle(3000);
    expect(result.current).toEqual(read(1));
  });

  it("polls every 3 seconds, which is how a read made in the other window shows up", async () => {
    const fetchRead = vi.fn().mockResolvedValue(read(1));
    renderHook(() => useLastRead("/work/app", fetchRead));
    await settle();
    expect(fetchRead).toHaveBeenCalledTimes(1);
    await settle(9000);
    expect(fetchRead).toHaveBeenCalledTimes(4);
    expect(fetchRead).toHaveBeenCalledWith("/work/app");
  });

  it("refreshes when the window gets the focus back", async () => {
    const fetchRead = vi.fn().mockResolvedValue(read(1));
    renderHook(() => useLastRead("/work/app", fetchRead));
    await settle();
    window.dispatchEvent(new Event("focus"));
    await settle();
    expect(fetchRead).toHaveBeenCalledTimes(2);
  });

  it("keeps the same object while nothing changed, so the screen is not redrawn every 3 seconds", async () => {
    const fetchRead = vi.fn().mockImplementation(async () => read(1));
    const { result } = renderHook(() => useLastRead("/work/app", fetchRead));
    await settle();
    const first = result.current;
    await settle(3000);
    expect(result.current).toBe(first);
    fetchRead.mockImplementation(async () => read(2));
    await settle(3000);
    expect(result.current).toEqual(read(2));
  });

  it("keeps the last read when a refresh fails", async () => {
    const fetchRead = vi.fn().mockResolvedValueOnce(read(1)).mockRejectedValue(new Error("gone"));
    const { result } = renderHook(() => useLastRead("/work/app", fetchRead));
    await settle(6000);
    expect(result.current).toEqual(read(1));
  });

  it("does not look without a project, and forgets the read when the project changes", async () => {
    const fetchRead = vi.fn().mockResolvedValue(read(1));
    const { result, rerender } = renderHook(({ root }: { root: string | null }) => useLastRead(root, fetchRead), {
      initialProps: { root: "/work/app" as string | null },
    });
    await settle();
    expect(result.current).toEqual(read(1));
    rerender({ root: null });
    await settle(6000);
    expect(result.current).toBeNull();
    expect(fetchRead).toHaveBeenCalledTimes(1);
  });

  it("ignores an answer about the previous project", async () => {
    let answerFirst!: (r: AgentRead | null) => void;
    const fetchRead = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => (answerFirst = resolve)))
      .mockResolvedValue(read(2));
    const { result, rerender } = renderHook(({ root }: { root: string }) => useLastRead(root, fetchRead), { initialProps: { root: "/a" } });
    rerender({ root: "/b" });
    await settle();
    await act(async () => answerFirst(read(1)));
    expect(result.current).toEqual(read(2));
  });
});
