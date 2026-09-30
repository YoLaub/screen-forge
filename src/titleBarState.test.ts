import { describe, expect, it } from "vitest";
import type { AgentStatus } from "./AgentSetup";
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
