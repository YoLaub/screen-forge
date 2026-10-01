import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Toasts from "./Toasts";

describe("Toasts", () => {
  it("shows a warning as an alert with its title and message", () => {
    render(<Toasts toasts={[{ id: 1, kind: "warn", title: "Nothing to cut", message: "Draw over a capture to cut a piece out." }]} onClose={() => {}} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Nothing to cut");
    expect(alert).toHaveTextContent("Draw over a capture to cut a piece out.");
  });

  it("shows a confirmation as a status", () => {
    render(<Toasts toasts={[{ id: 1, kind: "ok", title: "Exported", message: "Login.png" }]} onClose={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent("Exported");
  });

  it("closes a toast from its close button", () => {
    const onClose = vi.fn();
    render(<Toasts toasts={[{ id: 7, kind: "warn", title: "Save failed" }]} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onClose).toHaveBeenCalledWith(7);
  });

  it("renders nothing when there is no toast", () => {
    const { container } = render(<Toasts toasts={[]} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
