import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AgentSetup, { type AgentStatus } from "./AgentSetup";

const BIN = "/Applications/ScreenForge.app/Contents/MacOS/screenforge-mcp";

function status(overrides: Partial<AgentStatus> = {}): AgentStatus {
  return {
    mcp_binary: { Ok: BIN },
    claude_code: { available: true, registered: null },
    claude_desktop: { available: true, registered: null },
    ...overrides,
  };
}

function setup(s: AgentStatus) {
  const onConfigure = vi.fn();
  render(<AgentSetup status={s} messages={{}} busy={null} onConfigure={onConfigure} onClose={() => {}} />);
  return onConfigure;
}

describe("AgentSetup", () => {
  it("offers to connect a client that is not registered", () => {
    const onConfigure = setup(status());
    fireEvent.click(screen.getByRole("button", { name: "Connect Claude Code" }));
    expect(onConfigure).toHaveBeenCalledWith("claude_code");
  });

  it("shows a client registered with this app's server as connected", () => {
    setup(status({ claude_desktop: { available: true, registered: BIN } }));
    expect(screen.getByTestId("claude_desktop-state")).toHaveTextContent("Connected");
    expect(screen.getByRole("button", { name: "Reconnect Claude Desktop" })).toBeEnabled();
  });

  it("flags a registration that points to another server", () => {
    setup(status({ claude_code: { available: true, registered: "/old/screenforge-mcp" } }));
    expect(screen.getByTestId("claude_code-state")).toHaveTextContent("Points to another server");
    expect(screen.getByRole("button", { name: "Update Claude Code" })).toBeEnabled();
  });

  it("disables a client that is not installed", () => {
    setup(status({ claude_code: { available: false, registered: null } }));
    expect(screen.getByTestId("claude_code-state")).toHaveTextContent("Not installed");
    expect(screen.getByRole("button", { name: "Connect Claude Code" })).toBeDisabled();
  });

  it("explains a missing server and disables every client", () => {
    setup(status({ mcp_binary: { Err: "The MCP server is missing at /x" } }));
    expect(screen.getByText("The MCP server is missing at /x")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect Claude Code" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Connect Claude Desktop" })).toBeDisabled();
  });
});
