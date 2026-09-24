import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LayerRow } from "./layers";
import LayersPanel from "./LayersPanel";

const rows: LayerRow[] = [
  { item: { id: "frm", name: "Login", kind: "frame", hidden: false, locked: false }, depth: 0 },
  { item: { id: "btn", name: "Button", kind: "vector_drawing", parent: "frm", hidden: true, locked: true }, depth: 1 },
];

function setup(selectedId: string | null = null) {
  const handlers = {
    onSelect: vi.fn(),
    onRename: vi.fn(),
    onToggleHidden: vi.fn(),
    onToggleLocked: vi.fn(),
    onForward: vi.fn(),
    onBackward: vi.fn(),
  };
  render(<LayersPanel rows={rows} selectedId={selectedId} {...handlers} />);
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
});
