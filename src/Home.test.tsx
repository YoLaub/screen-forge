import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "./Home";

describe("Home", () => {
  it("presents the app and says where the canvas is saved", () => {
    render(<Home onOpen={() => {}} />);
    expect(screen.getByRole("heading", { name: "ScreenForge" })).toBeInTheDocument();
    expect(screen.getByText(/Pick the project folder\. The canvas is saved in its/)).toHaveTextContent(".screenforge/");
  });

  it("opens the folder picker from the Open a folder card, which shows its shortcut", () => {
    const onOpen = vi.fn();
    render(<Home onOpen={onOpen} />);
    const card = screen.getByRole("button", { name: "Open a folder" });
    expect(card).toHaveTextContent("⌘O");
    fireEvent.click(card);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("shows the project being opened instead of the card", () => {
    render(<Home opening="acme-dashboard" onOpen={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent("Opening acme-dashboard…");
    expect(screen.getByRole("status")).toHaveTextContent("Loading the canvas from .screenforge/");
    expect(screen.queryByRole("button", { name: "Open a folder" })).not.toBeInTheDocument();
  });
});
