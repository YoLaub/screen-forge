import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LayerRow } from "./layers";
import LayersPanel from "./LayersPanel";

const rows: LayerRow[] = [
  { item: { id: "frm", name: "Login", kind: "frame", icon: "frame", hidden: false, locked: false }, depth: 0 },
  {
    item: { id: "btn", name: "Button", kind: "vector_drawing", icon: "arrow", instructed: true, parent: "frm", hidden: true, locked: true },
    depth: 1,
  },
];

function setup(selectedId: string | null = null, shown: LayerRow[] = rows, floating = false) {
  const handlers = {
    onSelect: vi.fn(),
    onRename: vi.fn(),
    onToggleHidden: vi.fn(),
    onToggleLocked: vi.fn(),
    onForward: vi.fn(),
    onBackward: vi.fn(),
    onCollapse: vi.fn(),
  };
  render(<LayersPanel rows={shown} selectedId={selectedId} floating={floating} {...handlers} />);
  return handlers;
}

describe("LayersPanel", () => {
  it("lists the layers and selects one on click", () => {
    const h = setup();
    fireEvent.click(screen.getByText("Button"));
    expect(h.onSelect).toHaveBeenCalledWith("btn");
  });

  it("renames a layer on double-click and Enter", () => {
    const h = setup();
    fireEvent.doubleClick(screen.getByText("Login"));
    const input = screen.getByLabelText("Rename Login");
    fireEvent.change(input, { target: { value: "Sign in" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(h.onRename).toHaveBeenCalledWith("frm", "Sign in");
  });

  it("toggles visibility and lock, labelled by the current state", () => {
    const h = setup();
    fireEvent.click(screen.getByRole("button", { name: "Show Button" }));
    expect(h.onToggleHidden).toHaveBeenCalledWith("btn");
    fireEvent.click(screen.getByRole("button", { name: "Unlock Button" }));
    expect(h.onToggleLocked).toHaveBeenCalledWith("btn");
    expect(screen.getByRole("button", { name: "Hide Login" })).toBeInTheDocument();
  });

  it("reorders only with a selection", () => {
    setup();
    expect(screen.getByRole("button", { name: "Bring forward" })).toBeDisabled();
    const h = setup("btn");
    fireEvent.click(screen.getAllByRole("button", { name: "Send backward" })[1]);
    expect(h.onBackward).toHaveBeenCalled();
  });

  it("shows each element's icon and marks the ones with instructions", () => {
    setup();
    expect(screen.getByText("Button").closest("li")!.querySelector("[data-icon]")).toHaveAttribute("data-icon", "arrow");
    expect(screen.getAllByTitle("Has instructions for the agent")).toHaveLength(1);
  });

  it("counts the elements that have instructions", () => {
    setup();
    expect(screen.getByText(/of 2 elements have instructions/)).toHaveTextContent("1 of 2 elements have instructions");
  });

  it("explains what will be listed when there is nothing yet", () => {
    setup(null, []);
    expect(screen.getByText("No layers yet. Captures, frames and annotations will be listed here.")).toBeInTheDocument();
    expect(screen.queryByText(/elements have instructions/)).not.toBeInTheDocument();
  });

  it("floats over the canvas when asked, docked otherwise", () => {
    setup(null, rows, true);
    expect(screen.getByRole("complementary", { name: "Layers" })).toHaveAttribute("data-layout", "floating");
  });

  it("folds away from a button in its header", () => {
    const h = setup();
    const hide = screen.getByRole("button", { name: "Hide layers" });
    expect(hide).toHaveAttribute("title", "Hide layers (⇧⌘H hides both panels)");
    fireEvent.click(hide);
    expect(h.onCollapse).toHaveBeenCalled();
  });
});
