/** Mirrors the `agent_status` command (a Rust `Result` serializes as Ok/Err). */
export interface ClientStatus {
  available: boolean;
  registered: string | null;
}

export interface AgentStatus {
  mcp_binary: { Ok: string } | { Err: string };
  claude_code: ClientStatus;
  claude_desktop: ClientStatus;
}

export type AgentClient = "claude_code" | "claude_desktop";

const CLIENTS: { id: AgentClient; label: string; missing: string }[] = [
  { id: "claude_code", label: "Claude Code", missing: "Not installed (the `claude` command was not found)" },
  { id: "claude_desktop", label: "Claude Desktop", missing: "Not installed" },
];

interface Props {
  status: AgentStatus;
  /** Result of the last action per client, shown under it. */
  messages: Partial<Record<AgentClient, string>>;
  busy: AgentClient | null;
  onConfigure: (client: AgentClient) => void;
  onClose: () => void;
}

export default function AgentSetup({ status, messages, busy, onConfigure, onClose }: Props) {
  const binary = "Ok" in status.mcp_binary ? status.mcp_binary.Ok : null;

  return (
    <div className="absolute inset-0 z-30 flex items-start justify-center bg-black/20 pt-16" onClick={onClose}>
      <div
        className="flex w-[30rem] flex-col gap-3 rounded-lg bg-white p-4 text-sm shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-semibold text-neutral-800">Connect AI agents</h2>
        <p className="text-neutral-500">
          Registers ScreenForge's MCP server so the agent can read your canvas.
        </p>
        {"Err" in status.mcp_binary && <p className="text-red-600">{status.mcp_binary.Err}</p>}

        {CLIENTS.map(({ id, label, missing }) => {
          const client = status[id];
          const [state, action] = !client.available
            ? [missing, "Connect"]
            : client.registered === null
              ? ["Not connected", "Connect"]
              : client.registered === binary
                ? ["Connected", "Reconnect"]
                : ["Points to another server", "Update"];
          return (
            <div key={id} className="flex flex-col gap-1 rounded border border-neutral-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-neutral-800">{label}</div>
                  <div data-testid={`${id}-state`} className="text-neutral-500">
                    {state}
                  </div>
                </div>
                <button
                  aria-label={`${action} ${label}`}
                  disabled={!binary || !client.available || busy !== null}
                  onClick={() => onConfigure(id)}
                  className="shrink-0 rounded-md bg-neutral-900 px-3 py-1.5 text-white hover:bg-neutral-700 disabled:bg-neutral-300"
                >
                  {busy === id ? "…" : action}
                </button>
              </div>
              {messages[id] && <p className="text-neutral-600">{messages[id]}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
