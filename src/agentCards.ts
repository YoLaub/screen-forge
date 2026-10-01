import type { AgentClient, ClientStatus } from "./AgentSetup";

export type CardState = "none" | "off" | "busy" | "on" | "other" | "fail";
export type Tone = "muted" | "neutral" | "accent" | "ok" | "warn";

/** What happened the last time the user pressed the card's button in this dialog. */
export interface ClientResult {
  connected?: boolean;
  error?: string;
}

export interface CardView {
  state: CardState;
  status: string;
  tone: Tone;
  button: string;
  /** Main action (teal): something needs doing. Otherwise a quiet outline. */
  primary: boolean;
  disabled: boolean;
  message?: { text: string; tone: "ok" | "warn" | "muted" };
}

export const CLIENT_LABEL: Record<AgentClient, string> = { claude_code: "Claude Code", claude_desktop: "Claude Desktop" };

const NOT_INSTALLED: Record<AgentClient, string> = {
  claude_code: "The `claude` command was not found on this Mac.",
  claude_desktop: "Claude Desktop isn’t installed on this Mac.",
};
const CONNECTED: Record<AgentClient, string> = {
  claude_code: "Connected for every project. Restart running Claude Code sessions to use it.",
  claude_desktop: "Connected. Quit and reopen Claude Desktop to load it.",
};

interface Input {
  id: AgentClient;
  client: ClientStatus;
  /** Path of this app's MCP server, null when it is missing. */
  binary: string | null;
  /** This client is being configured. */
  busy: boolean;
  /** Any client is being configured: one at a time. */
  anyBusy: boolean;
  result: ClientResult | undefined;
}

/** Everything the Connect AI card of one client shows, from what the machine reports. */
export function cardView({ id, client, binary, busy, anyBusy, result }: Input): CardView {
  const blocked = !binary || anyBusy;
  if (busy) return { state: "busy", status: "Connecting…", tone: "accent", button: "Connecting…", primary: false, disabled: true };
  if (result?.error) {
    return {
      state: "fail",
      status: "Connection failed",
      tone: "warn",
      button: "Retry",
      primary: true,
      disabled: blocked,
      message: { text: `Couldn’t connect: ${result.error}`, tone: "warn" },
    };
  }
  if (!client.available) {
    return {
      state: "none",
      status: "Not installed",
      tone: "muted",
      button: "Connect",
      primary: false,
      disabled: true,
      message: { text: NOT_INSTALLED[id], tone: "muted" },
    };
  }
  if (client.registered === null) {
    return { state: "off", status: "Not connected", tone: "neutral", button: "Connect", primary: true, disabled: blocked };
  }
  if (client.registered === binary) {
    return {
      state: "on",
      status: "Connected",
      tone: "ok",
      button: "Reconnect",
      primary: false,
      disabled: blocked,
      ...(result?.connected && { message: { text: CONNECTED[id], tone: "ok" as const } }),
    };
  }
  return {
    state: "other",
    status: "Points to another server",
    tone: "warn",
    button: "Update",
    primary: true,
    disabled: blocked,
    message: { text: "Registered to another ScreenForge server. Update to point it at this project.", tone: "warn" },
  };
}
