import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentRead } from "./agentRead";
import type { AgentStatus } from "./AgentSetup";
import TitleBar from "./TitleBar";

const NOW = new Date(2026, 9, 1, 14, 10).getTime();
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

const status: AgentStatus = {
  mcp_binary: { Ok: "/app/screenforge-mcp" },
  claude_code: { available: true, registered: "/app/screenforge-mcp" },
  claude_desktop: { available: false, registered: null },
};
const read = (at_ms: number): AgentRead => ({ at_ms, tool: "get_canvas_snapshot", client: "claude-code", nodes: 8, with_instructions: 4 });

function setup(lastRead: AgentRead | null) {
  render(
    <TitleBar
      folder="acme-dashboard"
      path="/dev/acme-dashboard"
      onChangeFolder={() => {}}
      saved={null}
      agentStatus={status}
      lastRead={lastRead}
      onAgent={() => {}}
      exportLabel="Export canvas"
      onExport={() => {}}
    />,
  );
}

describe("TitleBar agent pill", () => {
  it("says connected until an agent has read the canvas", () => {
    setup(null);
    expect(screen.getByRole("button", { name: "Claude Code connected" })).toBeInTheDocument();
  });

  it("says when the canvas was read", () => {
    setup(read(NOW - 10_000));
    expect(screen.getByRole("button", { name: "Claude Code read the canvas · just now" })).toBeInTheDocument();
  });

  it("moves on by itself: just now becomes minutes ago without anything else happening", () => {
    setup(read(NOW - 10_000));
    act(() => vi.advanceTimersByTime(5 * 60_000));
    expect(screen.getByRole("button", { name: "Claude Code read the canvas · 5 min ago" })).toBeInTheDocument();
  });

  it("offers Connect AI when no agent points at this server", () => {
    render(
      <TitleBar
        folder="acme-dashboard"
        path="/x"
        onChangeFolder={() => {}}
        saved={null}
        agentStatus={{ ...status, claude_code: { available: true, registered: null } }}
        lastRead={read(NOW)}
        onAgent={() => {}}
        exportLabel={null}
        onExport={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Connect AI" })).toBeInTheDocument();
  });
});
