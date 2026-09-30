import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Toolbar from "./Toolbar";
import type { CutMode, GroupChoice, Tool } from "./tools";

function setup(tool: Tool = "select", choice: GroupChoice = { shape: "rect", line: "line" }, cutMode: CutMode = "lasso") {
  const onTool = vi.fn();
  const onCutMode = vi.fn();
  const onCapture = vi.fn();
  render(<Toolbar tool={tool} choice={choice} cutMode={cutMode} onTool={onTool} onCutMode={onCutMode} onCapture={onCapture} />);
  return { onTool, onCutMode, onCapture };
}

describe("Toolbar", () => {
  it("has one button per tool or group, each titled with its key", () => {
    setup();
    for (const title of ["Select (V)", "Frame (F)", "Rectangle (R)", "Line (L)", "Cross (X)", "Pen (P)", "Text (T)", "Cut (C)"]) {
      expect(screen.getByRole("button", { name: title })).toBeInTheDocument();
    }
  });

  it("marks the active tool", () => {
    setup("pen");
    expect(screen.getByRole("button", { name: "Pen (P)" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Select (V)" })).toHaveAttribute("aria-pressed", "false");
  });

  it("group buttons show and pick the last tool of their group", () => {
    const { onTool } = setup("select", { shape: "ellipse", line: "arrow" });
    fireEvent.click(screen.getByRole("button", { name: "Ellipse (O)" }));
    expect(onTool).toHaveBeenCalledWith("ellipse");
    expect(screen.getByRole("button", { name: "Arrow (A)" })).toBeInTheDocument();
  });

  it("opens a flyout to pick another tool of the group", () => {
    const { onTool } = setup();
    fireEvent.click(screen.getByRole("button", { name: "More shapes" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Polygon/ }));
    expect(onTool).toHaveBeenCalledWith("polygon");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("shows cut modes and their hint only while Cut is active", () => {
    setup("select");
    expect(screen.queryByText("Circle an area of a capture")).not.toBeInTheDocument();
    const { onCutMode } = setup("cut", undefined, "lasso");
    expect(screen.getByText("Circle an area of a capture")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ellipse" }));
    expect(onCutMode).toHaveBeenCalledWith("ellipse");
  });

  it("captures a window from its own button", () => {
    const { onCapture } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Capture window/ }));
    expect(onCapture).toHaveBeenCalled();
  });
});
