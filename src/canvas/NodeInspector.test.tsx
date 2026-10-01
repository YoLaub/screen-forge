import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import NodeInspector, { type InspectorNode } from "./NodeInspector";

const node: InspectorNode = {
  id: "cap_2nz66pbb",
  kind: "capture",
  typeLabel: "Capture",
  name: "Login error",
  instructions: "Border should be red",
  links: [{ target_node: "vec_2", trigger: "onError", payload_type: "" }],
  size: { width: 1280, height: 864 },
};
const others = [
  { id: "vec_2", name: "Login form", type: "Rectangle" },
  { id: "vec_3", name: "Success modal", type: "Frame" },
];

function setup(n: InspectorNode = node) {
  const onChange = vi.fn();
  render(<NodeInspector node={n} others={others} onChange={onChange} onCollapse={() => {}} />);
  return onChange;
}

describe("NodeInspector", () => {
  it("heads with the element type and id, and copies the id", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    setup();
    expect(screen.getByText("CAPTURE")).toBeInTheDocument();
    expect(screen.getByText("CAP_2NZ66PBB")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy id" }));
    expect(writeText).toHaveBeenCalledWith("cap_2nz66pbb");
  });

  it("shows the node name and instructions", () => {
    setup();
    expect(screen.getByLabelText("Name")).toHaveValue("Login error");
    expect(screen.getByLabelText("Instructions for the agent")).toHaveValue("Border should be red");
    expect(screen.getByText("Sent with the image, position, style and links.")).toBeInTheDocument();
  });

  it("shows the pin number of an element with instructions", () => {
    setup({ ...node, pin: 3 });
    expect(screen.getByTitle("Pin 3 on the canvas")).toHaveTextContent("3");
  });

  it("reports name and instruction edits", () => {
    const onChange = setup();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Login banner" } });
    expect(onChange).toHaveBeenLastCalledWith({ name: "Login banner" });
    fireEvent.change(screen.getByLabelText("Instructions for the agent"), { target: { value: "Use red-600" } });
    expect(onChange).toHaveBeenLastCalledWith({ instructions: "Use red-600" });
  });

  it("leaves the instructions with Cmd+Enter", () => {
    setup();
    const field = screen.getByLabelText("Instructions for the agent");
    field.focus();
    fireEvent.keyDown(field, { key: "Enter", metaKey: true });
    expect(field).not.toHaveFocus();
  });

  it("lists existing links as cards with the target name and type", () => {
    setup();
    expect(screen.getByText("Login form")).toBeInTheDocument();
    expect(screen.getByText("Rectangle")).toBeInTheDocument();
    expect(screen.getByLabelText("Trigger of link to Login form")).toHaveValue("onError");
  });

  it("says when there is no link yet", () => {
    setup({ ...node, links: [] });
    expect(screen.getByText("None yet")).toBeInTheDocument();
  });

  it("adds a link to the picked node, offered with its type", () => {
    const onChange = setup();
    expect(screen.getByRole("option", { name: "Success modal · Frame" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Link to"), { target: { value: "vec_3" } });
    expect(onChange).toHaveBeenLastCalledWith({
      links: [...node.links, { target_node: "vec_3", trigger: "", payload_type: "" }],
    });
  });

  it("edits and removes a link", () => {
    const onChange = setup();
    fireEvent.change(screen.getByLabelText("Payload type of link to Login form"), {
      target: { value: "AuthError" },
    });
    expect(onChange).toHaveBeenLastCalledWith({
      links: [{ target_node: "vec_2", trigger: "onError", payload_type: "AuthError" }],
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove link to Login form" }));
    expect(onChange).toHaveBeenLastCalledWith({ links: [] });
  });

  it("shows the style of a drawing, collapsible, and reports style edits", () => {
    const onChange = vi.fn();
    render(
      <NodeInspector
        node={{ ...node, kind: "vector_drawing", typeLabel: "Rectangle", size: undefined, style: { fill: "#E5E7EB" }, styleApplies: { fill: true, radius: true, text: false } }}
        others={others}
        onChange={onChange}
        onCollapse={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText("Opacity"), { target: { value: "40" } });
    expect(onChange).toHaveBeenLastCalledWith({ style: { fill: "#E5E7EB", opacity: 0.4 } });
    fireEvent.click(screen.getByRole("button", { name: "Style" }));
    expect(screen.queryByLabelText("Opacity")).not.toBeInTheDocument();
  });

  it("describes a capture instead of a style", () => {
    setup();
    expect(screen.queryByRole("button", { name: "Style" })).not.toBeInTheDocument();
    expect(screen.getByText("1280 × 864")).toBeInTheDocument();
    expect(screen.getByText("Captures have no style. Press C to cut a piece out.")).toBeInTheDocument();
  });

  it("tells what a frame contains", () => {
    setup({ ...node, kind: "frame", typeLabel: "Frame", size: undefined, childCount: 4 });
    expect(screen.getByText("Contains 4 elements. Moving the frame moves its content.")).toBeInTheDocument();
  });

  it("folds away from a button in its header", () => {
    const onCollapse = vi.fn();
    render(<NodeInspector node={node} others={others} onChange={() => {}} onCollapse={onCollapse} />);
    const hide = screen.getByRole("button", { name: "Hide inspector" });
    expect(hide).toHaveAttribute("title", "Hide inspector (⇧⌘H hides both panels)");
    fireEvent.click(hide);
    expect(onCollapse).toHaveBeenCalled();
  });
});
