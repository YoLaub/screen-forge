import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PanelOpener from "./PanelOpener";

describe("PanelOpener", () => {
  it("is a button named after the panel it reopens, with the shortcut in its title", () => {
    render(<PanelOpener label="Layers" side="left" onClick={() => {}} />);
    expect(screen.getByRole("button", { name: "Layers" })).toHaveAttribute("title", "Show layers (⇧⌘H shows both panels)");
  });

  it("reopens the panel on click", () => {
    const onClick = vi.fn();
    render(<PanelOpener label="Inspector" side="right" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: "Inspector" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("sits on the side of its panel", () => {
    render(<PanelOpener label="Inspector" side="right" onClick={() => {}} />);
    expect(screen.getByRole("button", { name: "Inspector" }).className).toMatch(/right-3/);
  });
});
