import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ZoomControl from "./ZoomControl";

function setup(zoom = 0.8) {
  const h = { onIn: vi.fn(), onOut: vi.fn(), onFit: vi.fn() };
  render(<ZoomControl zoom={zoom} {...h} />);
  return h;
}

describe("ZoomControl", () => {
  it("shows the zoom as a percentage", () => {
    setup(0.8);
    expect(screen.getByText("80%")).toBeInTheDocument();
  });

  it("zooms out, in and fits all, each titled with its shortcut", () => {
    const h = setup();
    fireEvent.click(screen.getByRole("button", { name: "Zoom out (⌘−)" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom in (⌘+)" }));
    fireEvent.click(screen.getByRole("button", { name: /Fit all/ }));
    expect(h.onOut).toHaveBeenCalledTimes(1);
    expect(h.onIn).toHaveBeenCalledTimes(1);
    expect(h.onFit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /Fit all/ })).toHaveTextContent("⇧1");
  });
});
