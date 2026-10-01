import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WindowPicker, { type PickerState, captureName, type WindowInfo } from "./WindowPicker";

const windows: WindowInfo[] = [
  { id: 1, app_name: "Safari", title: "Acme · Sign in", width: 1280, height: 864 },
  { id: 2, app_name: "Google Chrome", title: "Acme · Dashboard", width: 1440, height: 900 },
  { id: 3, app_name: "Safari", title: "Acme · Pricing", width: 1280, height: 864 },
  { id: 4, app_name: "Simulator", title: "", width: 393, height: 852 },
];

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup(state: PickerState = { status: "list", windows }) {
  const h = {
    onPick: vi.fn(),
    onCancel: vi.fn(),
    onRetry: vi.fn(),
    onOpenSettings: vi.fn(),
    capture: vi.fn().mockImplementation(async (id: number) => `PNG${id}`),
  };
  render(<WindowPicker state={state} {...h} />);
  return h;
}
const input = () => screen.getByLabelText("Filter windows");

describe("captureName", () => {
  it("uses app and title, or the app alone", () => {
    expect(captureName(windows[1])).toBe("Google Chrome — Acme · Dashboard");
    expect(captureName(windows[3])).toBe("Simulator");
  });
});

describe("WindowPicker list", () => {
  it("lists windows grouped by app, with their size", () => {
    setup();
    expect(screen.getAllByText("Safari")).toHaveLength(1);
    expect(screen.getByText("Google Chrome")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Acme · Pricing/ })).toHaveTextContent("1280 × 864");
  });

  it("picks a window on click", () => {
    const h = setup();
    fireEvent.click(screen.getByRole("option", { name: /Acme · Dashboard/ }));
    expect(h.onPick).toHaveBeenCalledWith(windows[1]);
  });

  it("moves with the arrows, in display order, and captures the active one with Enter", () => {
    const h = setup();
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    // Display order: Safari 1, Safari 3, Chrome 2.
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(h.onPick).toHaveBeenCalledWith(windows[1]);
  });

  it("starts on the first window, stops at the ends, and follows the pointer", () => {
    const h = setup();
    fireEvent.keyDown(input(), { key: "ArrowUp" });
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(h.onPick).toHaveBeenLastCalledWith(windows[0]);
    fireEvent.mouseEnter(screen.getByRole("option", { name: /Simulator/ }));
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(h.onPick).toHaveBeenLastCalledWith(windows[3]);
  });

  it("filters by app or title, and says when nothing matches", () => {
    setup();
    fireEvent.change(input(), { target: { value: "pricing" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    fireEvent.change(input(), { target: { value: "zzz" } });
    expect(screen.getByText("No window matches “zzz”.")).toBeInTheDocument();
  });

  it("cancels with Escape", () => {
    const h = setup();
    fireEvent.keyDown(input(), { key: "Escape" });
    expect(h.onCancel).toHaveBeenCalled();
  });

  it("shows the keyboard hints and the global shortcut", () => {
    setup();
    expect(screen.getByText("navigate")).toBeInTheDocument();
    expect(screen.getByText("capture")).toBeInTheDocument();
    expect(screen.getByText("⌘⇧X")).toBeInTheDocument();
  });
});

describe("WindowPicker preview", () => {
  it("shows the active window's title, app and size, and a Capture button", () => {
    const h = setup();
    const pane = screen.getByLabelText("Preview");
    expect(pane).toHaveTextContent("Acme · Sign in");
    expect(pane).toHaveTextContent("Safari · 1280 × 864");
    fireEvent.click(screen.getByRole("button", { name: "Capture to canvas" }));
    expect(h.onPick).toHaveBeenCalledWith(windows[0]);
  });

  it("captures a preview of the active window once it has rested there", async () => {
    const h = setup();
    expect(h.capture).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(h.capture).toHaveBeenCalledWith(1);
    expect(screen.getByRole("img", { name: "Preview of Safari — Acme · Sign in" })).toHaveAttribute("src", "data:image/png;base64,PNG1");
  });

  it("says when a preview cannot be captured", async () => {
    const h = { onPick: vi.fn(), onCancel: vi.fn(), onRetry: vi.fn(), onOpenSettings: vi.fn(), capture: vi.fn().mockRejectedValue("no") };
    render(<WindowPicker state={{ status: "list", windows }} {...h} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(screen.getByText("Preview unavailable")).toBeInTheDocument();
  });
});

describe("WindowPicker states", () => {
  it("shows a loading state while windows are listed", () => {
    setup({ status: "loading" });
    expect(screen.getByText("Looking for open windows…")).toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("explains a missing permission, opens the settings, and tries again", () => {
    const h = setup({ status: "permission" });
    expect(screen.getByText("Screen Recording permission needed")).toBeInTheDocument();
    expect(screen.getByText(/macOS may ask you to reopen ScreenForge/)).toBeInTheDocument();
    expect(screen.getByText("You can still paste or drop images onto the canvas.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open Screen Recording settings" }));
    expect(h.onOpenSettings).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(h.onRetry).toHaveBeenCalled();
  });

  it("explains an empty list and refreshes it", () => {
    const h = setup({ status: "list", windows: [] });
    expect(screen.getByText("No window to capture.")).toBeInTheDocument();
    expect(screen.getByText(/Minimized windows and other Spaces aren't listed/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh list" }));
    expect(h.onRetry).toHaveBeenCalled();
  });

  it("still cancels with Escape in every state", () => {
    for (const state of [{ status: "loading" }, { status: "permission" }, { status: "list", windows: [] }] as PickerState[]) {
      const h = setup(state);
      fireEvent.keyDown(input(), { key: "Escape" });
      expect(h.onCancel).toHaveBeenCalled();
      document.body.innerHTML = "";
    }
  });
});

describe("WindowPicker focus", () => {
  it("puts the focus back on the search field when the state changes, so the keyboard keeps working", () => {
    const h = { onPick: vi.fn(), onCancel: vi.fn(), onRetry: vi.fn(), onOpenSettings: vi.fn(), capture: vi.fn().mockResolvedValue("PNG") };
    const { rerender } = render(<WindowPicker state={{ status: "permission" }} {...h} />);
    screen.getByRole("button", { name: "Try again" }).focus();
    // Try again: the button is replaced by the loading state, and the focus falls to the page.
    rerender(<WindowPicker state={{ status: "loading" }} {...h} />);
    (document.activeElement as HTMLElement).blur();
    rerender(<WindowPicker state={{ status: "list", windows }} {...h} />);
    expect(input()).toHaveFocus();
  });

  it("cancels with Escape from a button too", () => {
    const h = setup({ status: "permission" });
    const button = screen.getByRole("button", { name: "Try again" });
    button.focus();
    fireEvent.keyDown(button, { key: "Escape" });
    expect(h.onCancel).toHaveBeenCalled();
  });
});

describe("WindowPicker in a browser whose scrollIntoView returns a Promise", () => {
  it("does not hand that Promise to React as an effect cleanup (Chrome 154 crashed the app)", () => {
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = vi.fn().mockResolvedValue(undefined);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      setup();
      expect(errors.mock.calls.flat().join(" ")).not.toMatch(/must not return anything besides a function/);
    } finally {
      errors.mockRestore();
      Element.prototype.scrollIntoView = original;
    }
  });
});
