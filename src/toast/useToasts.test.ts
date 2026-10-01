import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TOAST_MS } from "./model";
import { useToasts } from "./useToasts";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useToasts", () => {
  it("shows a pushed toast", () => {
    const { result } = renderHook(() => useToasts());
    act(() => result.current.push({ kind: "warn", title: "Nothing to cut" }));
    expect(result.current.toasts.map((t) => t.title)).toEqual(["Nothing to cut"]);
  });

  it("dismisses confirmations and warnings after their own delay", () => {
    const { result } = renderHook(() => useToasts());
    act(() => {
      result.current.push({ kind: "ok", title: "Exported" });
      result.current.push({ kind: "warn", title: "Save failed" });
    });
    act(() => vi.advanceTimersByTime(TOAST_MS.ok + 1));
    expect(result.current.toasts.map((t) => t.title)).toEqual(["Save failed"]);
    act(() => vi.advanceTimersByTime(TOAST_MS.warn));
    expect(result.current.toasts).toEqual([]);
  });

  it("keeps a sticky toast until it is dismissed", () => {
    const { result } = renderHook(() => useToasts());
    act(() => result.current.push({ kind: "warn", title: "Load failed", sticky: true }));
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.toasts).toHaveLength(1);
    act(() => result.current.dismiss(result.current.toasts[0].id));
    expect(result.current.toasts).toEqual([]);
  });

  it("restarts the delay when the same toast is pushed again", () => {
    const { result } = renderHook(() => useToasts());
    act(() => result.current.push({ kind: "warn", title: "Save failed", message: "x" }));
    act(() => vi.advanceTimersByTime(TOAST_MS.warn - 1000));
    act(() => result.current.push({ kind: "warn", title: "Save failed", message: "x" }));
    act(() => vi.advanceTimersByTime(TOAST_MS.warn - 1000));
    expect(result.current.toasts).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1500));
    expect(result.current.toasts).toEqual([]);
  });

  it("returns stable push and dismiss, safe to capture in long-lived handlers", () => {
    const { result, rerender } = renderHook(() => useToasts());
    const { push, dismiss } = result.current;
    rerender();
    expect(result.current.push).toBe(push);
    expect(result.current.dismiss).toBe(dismiss);
  });
});
