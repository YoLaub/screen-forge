import { useEffect } from "react";
import { type ClientResult, type Tone, cardView, CLIENT_LABEL } from "./agentCards";

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

const CLIENTS: AgentClient[] = ["claude_code", "claude_desktop"];

const TONE_TEXT: Record<Tone, string> = { muted: "text-tx3", neutral: "text-tx2", accent: "text-acc", ok: "text-ok", warn: "text-warn" };
const TONE_DOT: Record<Tone, string> = { muted: "bg-tx3", neutral: "bg-tx2", accent: "bg-acc", ok: "bg-ok", warn: "bg-warn" };
const MESSAGE: Record<"ok" | "warn" | "muted", string> = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  muted: "bg-panel2 text-tx2",
};

interface Props {
  status: AgentStatus;
  /** The open project: the MCP server serves its `.screenforge/` folder. */
  project: { name: string; path: string };
  /** What happened the last time each client's button was pressed. */
  results: Partial<Record<AgentClient, ClientResult>>;
  busy: AgentClient | null;
  /** When an agent last read the canvas; null until something records reads. */
  lastRead?: string | null;
  onConfigure: (client: AgentClient) => void;
  onClose: () => void;
}

function ClientIcon({ id }: { id: AgentClient }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
      {id === "claude_code" ? <path d="M4.5 6.5L7 8.5 4.5 10.5M8.5 10.5h3" /> : <path d="M1.5 5.5h13" />}
    </svg>
  );
}

export default function AgentSetup({ status, project, results, busy, lastRead, onConfigure, onClose }: Props) {
  const binary = "Ok" in status.mcp_binary ? status.mcp_binary.Ok : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div data-testid="agent-scrim" className="absolute inset-0 z-30 grid place-items-center bg-scrim" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Connect AI agents"
        className="w-[540px] max-w-[calc(100%-32px)] overflow-hidden rounded-[14px] border border-line2 bg-panel text-xs text-tx shadow-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 px-[18px] pt-[18px] pb-3.5">
          <div className="flex flex-1 flex-col gap-[5px]">
            <h2 className="text-base font-semibold">Connect AI agents</h2>
            <p className="leading-normal text-balance text-tx2">Registers ScreenForge's MCP server so the agent can read your canvas.</p>
          </div>
          <button aria-label="Close" onClick={onClose} className="grid size-7 place-items-center rounded-[7px] text-tx3 hover:bg-hover">
            <svg width="12" height="12" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.7">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        <div className="mx-[18px] mb-3.5 flex items-center gap-2 rounded-lg bg-panel2 px-2.5 py-2 text-[11.5px] text-tx2">
          <span className={`size-[7px] flex-none rounded-full ${binary ? "bg-ok ring-3 ring-ok-soft" : "bg-warn ring-3 ring-warn-soft"}`} />
          <span className="flex-none whitespace-nowrap">{binary ? "MCP server ready" : "MCP server not found"}</span>
          <span className="flex-1" />
          {binary ? (
            <span title={`${project.path}/.screenforge`} className="truncate font-mono text-[10.5px] text-tx3">
              {project.name}/.screenforge
            </span>
          ) : (
            <span className="min-w-0 truncate text-warn" title={"Err" in status.mcp_binary ? status.mcp_binary.Err : undefined}>
              {"Err" in status.mcp_binary ? status.mcp_binary.Err : ""}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2.5 px-[18px] pb-[18px]">
          {CLIENTS.map((id) => {
            const label = CLIENT_LABEL[id];
            const v = cardView({ id, client: status[id], binary, busy: busy === id, anyBusy: busy !== null, result: results[id] });
            return (
              <div key={id} className="overflow-hidden rounded-[11px] border border-line2">
                <div className="flex items-center gap-3 p-3">
                  <span className="grid size-[34px] flex-none place-items-center rounded-[9px] border border-line bg-panel2 text-tx2">
                    <ClientIcon id={id} />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-[13px] font-semibold">{label}</span>
                    <span data-testid={`${id}-state`} className={`flex items-center gap-1.5 text-[11.5px] ${TONE_TEXT[v.tone]}`}>
                      <span className={`size-1.5 rounded-full ${TONE_DOT[v.tone]}`} />
                      {v.status}
                    </span>
                  </div>
                  <button
                    aria-label={`${v.button.replace("…", "")} ${label}`}
                    disabled={v.disabled}
                    onClick={() => onConfigure(id)}
                    className={`flex h-[30px] items-center gap-[7px] rounded-lg border px-[13px] text-xs font-semibold whitespace-nowrap ${
                      v.primary ? "border-acc bg-acc text-acc-tx hover:opacity-90" : "border-line2 text-tx hover:bg-hover"
                    } ${v.disabled && v.state !== "busy" ? "opacity-45" : ""}`}
                  >
                    {v.state === "busy" && <span className="size-[11px] animate-spin rounded-full border-2 border-current/35 border-t-current" />}
                    {v.button}
                  </button>
                </div>
                {v.message && <div className={`border-t border-line px-3 py-[9px] text-[11.5px] leading-[1.45] ${MESSAGE[v.message.tone]}`}>{v.message.text}</div>}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 border-t border-line bg-panel2 px-[18px] py-[11px] text-[11.5px] text-tx2">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="flex-none text-tx3">
            <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
            <circle cx="8" cy="8" r="2" />
          </svg>
          <span>{lastRead ?? "No agent has read this canvas yet."}</span>
        </div>
      </div>
    </div>
  );
}
