import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AgentSetup, { type AgentClient, type AgentStatus } from "./AgentSetup";
import type { ClientResult } from "./agentCards";

const BIN = "/Applications/ScreenForge.app/Contents/MacOS/screenforge-mcp";

function status(overrides: Partial<AgentStatus> = {}): AgentStatus {
  return {
    mcp_binary: { Ok: BIN },
    claude_code: { available: true, registered: null },
    claude_desktop: { available: true, registered: null },
    ...overrides,
  };
}

function setup(
  s: AgentStatus,
  extra: { busy?: AgentClient | null; results?: Partial<Record<AgentClient, ClientResult>>; lastRead?: string | null } = {},
) {
  const onConfigure = vi.fn();
  const onClose = vi.fn();
  render(
    <AgentSetup
      status={s}
      project={{ name: "acme-dashboard", path: "/Users/me/dev/acme-dashboard" }}
      results={extra.results ?? {}}
      busy={extra.busy ?? null}
      lastRead={extra.lastRead}
      onConfigure={onConfigure}
      onClose={onClose}
    />,
  );
  return { onConfigure, onClose };
}

describe("AgentSetup", () => {
  it("titles itself and says what connecting does", () => {
    setup(status());
    expect(screen.getByRole("dialog", { name: "Connect AI agents" })).toBeInTheDocument();
    expect(screen.getByText("Registers ScreenForge's MCP server so the agent can read your canvas.")).toBeInTheDocument();
  });

  it("closes from its button, Escape and a click outside", () => {
    const { onClose } = setup(status());
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByTestId("agent-scrim"));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("does not close when the dialog itself is clicked", () => {
    const { onClose } = setup(status());
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("says the MCP server is ready, with the project it serves", () => {
    setup(status());
    expect(screen.getByText("MCP server ready")).toBeInTheDocument();
    expect(screen.getByText("acme-dashboard/.screenforge")).toHaveAttribute("title", "/Users/me/dev/acme-dashboard/.screenforge");
  });

  it("explains a missing server instead, and disables every client", () => {
    setup(status({ mcp_binary: { Err: "The MCP server is missing at /x" } }));
    expect(screen.getByText("MCP server not found")).toBeInTheDocument();
    expect(screen.getByText("The MCP server is missing at /x")).toBeInTheDocument();
    expect(screen.queryByText("MCP server ready")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect Claude Code" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Connect Claude Desktop" })).toBeDisabled();
  });

  it("offers to connect a client that is not registered", () => {
    const { onConfigure } = setup(status());
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
    expect(screen.getByText(/Registered to another ScreenForge server/)).toBeInTheDocument();
  });

  it("disables a client that is not installed", () => {
    setup(status({ claude_code: { available: false, registered: null } }));
    expect(screen.getByTestId("claude_code-state")).toHaveTextContent("Not installed");
    expect(screen.getByRole("button", { name: "Connect Claude Code" })).toBeDisabled();
  });

  it("shows Connecting… on the client being configured and blocks the other", () => {
    setup(status(), { busy: "claude_code" });
    expect(screen.getByTestId("claude_code-state")).toHaveTextContent("Connecting…");
    expect(screen.getByRole("button", { name: "Connecting Claude Code" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Connect Claude Desktop" })).toBeDisabled();
  });

  it("shows the reason of a failed attempt and offers to retry", () => {
    const { onConfigure } = setup(status(), { results: { claude_code: { error: "permission denied" } } });
    expect(screen.getByText("Couldn’t connect: permission denied")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry Claude Code" }));
    expect(onConfigure).toHaveBeenCalledWith("claude_code");
  });

  it("tells to restart the client right after connecting it", () => {
    setup(status({ claude_code: { available: true, registered: BIN } }), { results: { claude_code: { connected: true } } });
    expect(screen.getByText(/Restart running Claude Code sessions/)).toBeInTheDocument();
  });

  it("says no agent has read the canvas until something reports a read", () => {
    setup(status());
    expect(screen.getByText("No agent has read this canvas yet.")).toBeInTheDocument();
  });

  it("shows the last read when there is one", () => {
    setup(status(), { lastRead: "Claude Code last read the canvas at 14:05 · 8 elements, 4 with instructions" });
    expect(screen.getByText(/last read the canvas at 14:05/)).toBeInTheDocument();
    expect(screen.queryByText("No agent has read this canvas yet.")).not.toBeInTheDocument();
  });
});
