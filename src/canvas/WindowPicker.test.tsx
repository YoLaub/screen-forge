import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WindowPicker, { captureName, type WindowInfo } from "./WindowPicker";

const windows: WindowInfo[] = [
  { id: 1, app_name: "Code", title: "main.rs — screen_forge", width: 1400, height: 900 },
  { id: 2, app_name: "Safari", title: "Login – My App", width: 1200, height: 800 },
  { id: 3, app_name: "Simulator", title: "", width: 400, height: 860 },
];

describe("captureName", () => {
  it("uses app and title, or the app alone", () => {
    expect(captureName(windows[1])).toBe("Safari — Login – My App");
    expect(captureName(windows[2])).toBe("Simulator");
  });
});

describe("WindowPicker", () => {
  it("lists windows and picks one on click", () => {
    const onPick = vi.fn();
    render(<WindowPicker windows={windows} onPick={onPick} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Safari — Login – My App/ }));
    expect(onPick).toHaveBeenCalledWith(windows[1]);
  });

  it("filters by app or title", () => {
    render(<WindowPicker windows={windows} onPick={() => {}} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText("Filter windows"), { target: { value: "login" } });
    expect(screen.getAllByRole("button", { name: /—|Simulator/ })).toHaveLength(1);
  });

  it("explains an empty list", () => {
    render(<WindowPicker windows={[]} onPick={() => {}} onCancel={() => {}} />);
    expect(screen.getByText(/No window to capture/)).toBeInTheDocument();
  });

  it("cancels with Escape", () => {
    const onCancel = vi.fn();
    render(<WindowPicker windows={windows} onPick={() => {}} onCancel={onCancel} />);
    fireEvent.keyDown(screen.getByLabelText("Filter windows"), { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });
});
