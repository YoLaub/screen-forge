import { type AgentRead, agoLabel, clientLabel } from "./agentRead";
import type { AgentStatus } from "./AgentSetup";

export interface AgentPill {
  connected: boolean;
  client?: "Claude Code" | "Claude Desktop";
  note?: string;
}

/**
 * The title bar's agent state: connected when a client is registered with this
 * app's MCP server (same rule as the Connect AI dialog), Claude Code first. Once an agent
 * has read the canvas, the note says when, and the pill names that agent if it is one
 * of the connected clients.
 */
export function agentPill(status: AgentStatus, read: AgentRead | null = null, nowMs: number = Date.now()): AgentPill {
  const binary = "Ok" in status.mcp_binary ? status.mcp_binary.Ok : null;
  if (!binary) return { connected: false };
  const connected: AgentPill["client"][] = [];
  if (status.claude_code.registered === binary) connected.push("Claude Code");
  if (status.claude_desktop.registered === binary) connected.push("Claude Desktop");
  if (connected.length === 0) return { connected: false };
  if (!read) return { connected: true, client: connected[0], note: "connected" };
  const reader = clientLabel(read.client);
  const client = connected.find((c) => c === reader) ?? connected[0];
  return { connected: true, client, note: `read the canvas · ${agoLabel(read.at_ms, nowMs)}` };
}

export function savedLabel(at: Date): string {
  const two = (n: number) => String(n).padStart(2, "0");
  return `Saved ${two(at.getHours())}:${two(at.getMinutes())}`;
}
