import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StyleSection from "./StyleSection";
import type { NodeStyle } from "./style";

const rect = { fill: true, radius: true, text: false };
const base: NodeStyle = { fill: "#E5E7EB", stroke: "#6B7280", stroke_width: 1 };

function setup(style: NodeStyle, applies = rect) {
  const onStyle = vi.fn();
  render(<StyleSection style={style} applies={applies} onStyle={onStyle} />);
  return onStyle;
}

describe("StyleSection", () => {
  it("shows the controls that apply to a rectangle", () => {
    setup(base);
    expect(screen.getByLabelText("Fill color")).toHaveValue("#E5E7EB");
    expect(screen.getByLabelText("Stroke width")).toHaveValue(1);
    expect(screen.getByLabelText("Corner radius")).toBeInTheDocument();
    expect(screen.queryByLabelText("Font size")).not.toBeInTheDocument();
  });

  it("has no fill for a line and font controls for text", () => {
    setup({ stroke: "#374151", stroke_width: 2 }, { fill: false, radius: false, text: false });
    expect(screen.queryByLabelText("Fill color")).not.toBeInTheDocument();
    setup({ fill: "#111827", font_size: 20 }, { fill: true, radius: false, text: true });
    expect(screen.getByLabelText("Font size")).toHaveValue(20);
  });

  it("applies a typed hex color on Enter and ignores an invalid one", () => {
    const onStyle = setup(base);
    const fill = screen.getByLabelText("Fill color");
    fireEvent.change(fill, { target: { value: "nope" } });
    fireEvent.keyDown(fill, { key: "Enter" });
    expect(onStyle).not.toHaveBeenCalled();
    fireEvent.change(fill, { target: { value: "ff0000" } });
    fireEvent.keyDown(fill, { key: "Enter" });
    expect(onStyle).toHaveBeenLastCalledWith({ ...base, fill: "#FF0000" });
  });

  it("turns a solid fill into a linear gradient starting from it", () => {
    const onStyle = setup(base);
    fireEvent.change(screen.getByLabelText("Fill type"), { target: { value: "linear" } });
    expect(onStyle).toHaveBeenLastCalledWith({
      stroke: "#6B7280",
      stroke_width: 1,
      gradient: {
        kind: "linear",
        angle: 90,
        stops: [
          { offset: 0, color: "#E5E7EB" },
          { offset: 1, color: "#FFFFFF" },
        ],
      },
    });
  });

  it("maps the opacity slider to 0-1 and drops full opacity", () => {
    const onStyle = setup(base);
    fireEvent.change(screen.getByLabelText("Opacity"), { target: { value: "50" } });
    expect(onStyle).toHaveBeenLastCalledWith({ ...base, opacity: 0.5 });
  });

  it("drops the opacity when the slider goes back to 100", () => {
    const onStyle = setup({ ...base, opacity: 0.5 });
    fireEvent.change(screen.getByLabelText("Opacity"), { target: { value: "100" } });
    expect(onStyle).toHaveBeenLastCalledWith({ ...base });
  });
});
