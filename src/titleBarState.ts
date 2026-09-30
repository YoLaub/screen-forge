import type { AgentStatus } from "./AgentSetup";

export interface AgentPill {
  connected: boolean;
  client?: "Claude Code" | "Claude Desktop";
  note?: string;
}

/**
 * The title bar's agent state: connected when a client is registered with this
 * app's MCP server (same rule as the Connect AI dialog), Claude Code first.
 */
export function agentPill(status: AgentStatus): AgentPill {
  const binary = "Ok" in status.mcp_binary ? status.mcp_binary.Ok : null;
  if (!binary) return { connected: false };
  if (status.claude_code.registered === binary) return { connected: true, client: "Claude Code", note: "connected" };
  if (status.claude_desktop.registered === binary) return { connected: true, client: "Claude Desktop", note: "connected" };
  return { connected: false };
}

export function savedLabel(at: Date): string {
  const two = (n: number) => String(n).padStart(2, "0");
  return `Saved ${two(at.getHours())}:${two(at.getMinutes())}`;
}
