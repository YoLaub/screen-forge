import { describe, expect, it } from "vitest";
import type { AgentStatus } from "./AgentSetup";
import type { AgentRead } from "./agentRead";
import { agentPill, savedLabel } from "./titleBarState";

const status = (code: string | null, desktop: string | null, binary = "/app/screenforge-mcp"): AgentStatus => ({
  mcp_binary: { Ok: binary },
  claude_code: { available: true, registered: code },
  claude_desktop: { available: true, registered: desktop },
});

describe("agentPill", () => {
  it("names Claude Code when it points at this app's MCP server", () => {
    expect(agentPill(status("/app/screenforge-mcp", null))).toEqual({ connected: true, client: "Claude Code", note: "connected" });
  });

  it("falls back to Claude Desktop", () => {
    expect(agentPill(status(null, "/app/screenforge-mcp"))).toEqual({ connected: true, client: "Claude Desktop", note: "connected" });
  });

  it("is not connected when nothing points at this server", () => {
    expect(agentPill(status(null, null)).connected).toBe(false);
    expect(agentPill(status("/other/screenforge-mcp", null)).connected).toBe(false);
  });

  it("is not connected when the MCP binary is missing", () => {
    const missing: AgentStatus = { ...status("/app/screenforge-mcp", null), mcp_binary: { Err: "not found" } };
    expect(agentPill(missing).connected).toBe(false);
  });
});

describe("savedLabel", () => {
  it("shows the save time as HH:MM, 24 h", () => {
    expect(savedLabel(new Date(2026, 8, 30, 14, 3, 59))).toBe("Saved 14:03");
    expect(savedLabel(new Date(2026, 8, 30, 9, 5))).toBe("Saved 09:05");
  });
});

describe("agentPill with a last read", () => {
  const NOW = new Date(2026, 9, 1, 14, 10).getTime();
  const read = (ago: number, client?: string): AgentRead => ({ at_ms: NOW - ago, tool: "get_canvas_snapshot", client, nodes: 8, with_instructions: 4 });
  const both = status("/app/screenforge-mcp", "/app/screenforge-mcp");

  it("shows when the canvas was last read instead of 'connected'", () => {
    expect(agentPill(status("/app/screenforge-mcp", null), read(10_000, "claude-code"), NOW)).toEqual({
      connected: true,
      client: "Claude Code",
      note: "read the canvas · just now",
    });
    expect(agentPill(status("/app/screenforge-mcp", null), read(5 * 60_000), NOW).note).toBe("read the canvas · 5 min ago");
  });

  it("names the agent that read when both are connected", () => {
    expect(agentPill(both, read(1000, "claude-ai"), NOW).client).toBe("Claude Desktop");
    expect(agentPill(both, read(1000, "claude-code"), NOW).client).toBe("Claude Code");
    expect(agentPill(both, read(1000), NOW).client).toBe("Claude Code");
  });

  it("keeps the connected client when the reader is one it cannot match", () => {
    expect(agentPill(status("/app/screenforge-mcp", null), read(1000, "claude-ai"), NOW).client).toBe("Claude Code");
    expect(agentPill(status("/app/screenforge-mcp", null), read(1000, "cursor"), NOW).client).toBe("Claude Code");
  });

  it("is still not connected when nothing points at this server, whatever was read", () => {
    expect(agentPill(status(null, null), read(1000, "claude-code"), NOW)).toEqual({ connected: false });
  });
});
