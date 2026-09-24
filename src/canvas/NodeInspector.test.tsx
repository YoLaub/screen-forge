import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import NodeInspector, { type InspectorNode } from "./NodeInspector";

const node: InspectorNode = {
  id: "cap_1",
  kind: "capture",
  name: "Login error",
  instructions: "Border should be red",
  links: [{ target_node: "vec_2", trigger: "onError", payload_type: "" }],
};
const others = [
  { id: "vec_2", name: "Login form" },
  { id: "vec_3", name: "Success modal" },
];

function setup() {
  const onChange = vi.fn();
  render(<NodeInspector node={node} others={others} onChange={onChange} />);
  return onChange;
}

describe("NodeInspector", () => {
  it("shows the node name and instructions", () => {
    setup();
    expect(screen.getByLabelText("Name")).toHaveValue("Login error");
    expect(screen.getByLabelText("Instructions for the agent")).toHaveValue("Border should be red");
  });

  it("reports name and instruction edits", () => {
    const onChange = setup();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Login banner" } });
    expect(onChange).toHaveBeenLastCalledWith({ name: "Login banner" });
    fireEvent.change(screen.getByLabelText("Instructions for the agent"), { target: { value: "Use red-600" } });
    expect(onChange).toHaveBeenLastCalledWith({ instructions: "Use red-600" });
  });

  it("lists existing links by target name", () => {
    setup();
    expect(screen.getByText("→ Login form")).toBeInTheDocument();
    expect(screen.getByLabelText("Trigger of link to Login form")).toHaveValue("onError");
  });

  it("adds a link to the picked node", () => {
    const onChange = setup();
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

  it("shows the style of a drawing and reports style edits", () => {
    const onChange = vi.fn();
    render(
      <NodeInspector
        node={{ ...node, kind: "vector_drawing", style: { fill: "#E5E7EB" }, styleApplies: { fill: true, radius: true, text: false } }}
        others={others}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText("Opacity"), { target: { value: "40" } });
    expect(onChange).toHaveBeenLastCalledWith({ style: { fill: "#E5E7EB", opacity: 0.4 } });
  });

  it("has no style section for a capture", () => {
    setup();
    expect(screen.queryByText("Style")).not.toBeInTheDocument();
  });
});
