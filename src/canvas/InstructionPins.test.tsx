import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import InstructionPins, { type Pin } from "./InstructionPins";

const pins: Pin[] = [
  { id: "btn", n: 1, name: "Sign-in button", text: "Make it full width", pin: { x: 10, y: 20 }, callout: { x: 40, y: 18 } },
  { id: "link", n: 2, name: "Forgot password", text: "Remove this link", pin: { x: 60, y: 80 }, callout: { x: 90, y: 78 } },
];

describe("InstructionPins", () => {
  it("shows one numbered pin per element with instructions", () => {
    render(<InstructionPins pins={pins} calloutsEnabled onPick={() => {}} />);
    const shown = screen.getAllByTitle("Instructions for the agent");
    expect(shown.map((p) => p.textContent)).toEqual(["1", "2"]);
  });

  it("previews the instructions on hover", () => {
    render(<InstructionPins pins={pins} calloutsEnabled onPick={() => {}} />);
    fireEvent.mouseEnter(screen.getByText("2"));
    expect(screen.getByText("For the agent · Forgot password")).toBeInTheDocument();
    expect(screen.getByText("Remove this link")).toBeInTheDocument();
    fireEvent.mouseLeave(screen.getByText("2"));
    expect(screen.queryByText("Remove this link")).not.toBeInTheDocument();
  });

  it("does not preview while an element is selected (the inspector shows it)", () => {
    render(<InstructionPins pins={pins} calloutsEnabled={false} onPick={() => {}} />);
    fireEvent.mouseEnter(screen.getByText("1"));
    expect(screen.queryByText("Make it full width")).not.toBeInTheDocument();
  });

  it("selects the element of a clicked pin", () => {
    const onPick = vi.fn();
    render(<InstructionPins pins={pins} calloutsEnabled onPick={onPick} />);
    fireEvent.click(screen.getByText("1"));
    expect(onPick).toHaveBeenCalledWith("btn");
  });
});
