import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EmptyCanvas from "./EmptyCanvas";

describe("EmptyCanvas", () => {
  it("tells what to do, in the mockup's words", () => {
    render(<EmptyCanvas onCapture={() => {}} />);
    expect(screen.getByText("Show the agent something")).toBeInTheDocument();
    expect(screen.getByText(/Capture any window on your Mac, or paste \/ drop an image here/)).toBeInTheDocument();
    expect(screen.getByText("⌘V")).toBeInTheDocument();
    expect(screen.getByText("⌘⇧X")).toBeInTheDocument();
  });

  it("captures a window from its button", () => {
    const onCapture = vi.fn();
    render(<EmptyCanvas onCapture={onCapture} />);
    fireEvent.click(screen.getByRole("button", { name: "Capture window" }));
    expect(onCapture).toHaveBeenCalled();
  });
});
