import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { AgentStatus } from "./AgentSetup";
import Logo from "./Logo";
import { agentTooltip, captureLines, nextMode, type PillEvent, type PillMode, shouldAutoDismiss } from "./pillState";
import {
  agentStatus,
  captureFront,
  onCanvasSummary,
  onCaptured,
  onCaptureFailed,
  pillSetState,
  pillSetTop,
  sendPillRequest,
  type ShortcutCapture,
  showMainWindow,
} from "./services/backend";
import { agentPill } from "./titleBarState";
import { BRAND } from "./theme/tokens";

type Card = { kind: "ok"; capture: ShortcutCapture } | { kind: "error"; message: string };

/** The card goes away by itself after this long when nobody touched it. */
const CARD_MS = 10_000;

function Action({
  label,
  hint,
  primary,
  busy,
  onClick,
  children,
}: {
  label: string;
  hint?: string;
  primary?: boolean;
  busy?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={hint ? `${label} (${hint})` : label}
      onClick={onClick}
      className={`grid h-[38px] w-[38px] place-items-center rounded-[10px] ${primary ? "bg-acc text-acc-tx" : "text-tx2 hover:bg-hover"}`}
    >
      {busy ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70" />
      ) : (
        children
      )}
    </button>
  );
}

const ICON = { width: 18, height: 18, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5 };

/**
 * The edge pill: its own small window, docked to the right of the screen on every
 * desktop. It captures without opening the app, then lets the user tell the agent what
 * to do with the capture. The window is resized by the backend to match `mode`.
 */
export default function Pill() {
  const [mode, setMode] = useState<PillMode>("collapsed");
  const [card, setCard] = useState<Card | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [instructions, setInstructions] = useState<number | null>(null);
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  function go(event: PillEvent) {
    const next = nextMode(modeRef.current, event);
    if (next === modeRef.current) return;
    modeRef.current = next;
    setMode(next);
    pillSetState(next).catch(() => {});
  }

  function dismiss() {
    setCard(null);
    setText("");
    go("dismiss");
  }

  useEffect(() => {
    // The window is transparent: only the pill itself is drawn.
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    agentStatus().then(setStatus, () => {});
    const unlisten = [
      onCaptured((capture) => {
        setBusy(false);
        setText("");
        setCard({ kind: "ok", capture });
        go("captured");
      }),
      onCaptureFailed((message) => {
        setBusy(false);
        setCard({ kind: "error", message });
        go("captured");
      }),
      onCanvasSummary(setInstructions),
    ];
    // The canvas may have told its summary before this window listened: ask again.
    Promise.all(unlisten)
      .then(() => sendPillRequest({ kind: "hello" }))
      .catch(() => {});
    return () => {
      unlisten.forEach((u) => u.then((fn) => fn()));
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && modeRef.current === "captured") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!card || !shouldAutoDismiss({ text, hovered, focused })) return;
    const timer = setTimeout(dismiss, CARD_MS);
    return () => clearTimeout(timer);
  }, [card, text, hovered, focused]);

  async function capture() {
    setBusy(true);
    try {
      await captureFront();
    } catch (error) {
      setBusy(false);
      setCard({ kind: "error", message: String(error) });
      go("captured");
    }
  }

  async function askCanvas(kind: "pick" | "paste") {
    await showMainWindow();
    await sendPillRequest({ kind });
  }

  function startDrag(e: React.MouseEvent) {
    e.preventDefault();
    const grab = e.clientY;
    const move = (m: MouseEvent) => {
      pillSetTop(modeRef.current, m.screenY - grab).catch(() => {});
    };
    const stop = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
  }

  const pill = status ? agentPill(status) : { connected: false };
  const agentLine = agentTooltip(pill, instructions);

  return (
    <div
      data-testid="pill"
      className="flex h-screen w-screen justify-end overflow-hidden text-xs text-tx"
      onMouseEnter={() => {
        setHovered(true);
        go("enter");
      }}
      onMouseLeave={() => {
        setHovered(false);
        go("leave");
      }}
    >
      {mode === "collapsed" && (
        <div
          title="ScreenForge"
          className="flex h-[72px] w-[14px] flex-col items-center justify-center gap-1.5 rounded-l-[9px] border border-r-0 border-line2 bg-panel"
        >
          <span className="h-[26px] w-1 rounded-sm" style={{ background: BRAND.gradient }} />
          <span className={`h-1.5 w-1.5 rounded-full ${pill.connected ? "bg-ok" : "bg-tx3"}`} />
        </div>
      )}

      {mode === "expanded" && (
        <div className="flex h-full w-[52px] flex-col items-center gap-1 rounded-l-[14px] border border-r-0 border-line2 bg-panel pb-2.5 pt-2">
          <div
            title="Drag to move"
            onMouseDown={startDrag}
            className="mb-1.5 h-[3px] w-[18px] cursor-ns-resize rounded-sm bg-line2"
          />
          <div className="mb-1.5">
            <Logo size={26} />
          </div>
          <Action label="Capture frontmost window" hint="⌘⇧X" primary busy={busy} onClick={capture}>
            <svg {...ICON}>
              <path d="M2 5V3.5c0-.8.7-1.5 1.5-1.5H5M11 2h1.5c.8 0 1.5.7 1.5 1.5V5M14 11v1.5c0 .8-.7 1.5-1.5 1.5H11M5 14H3.5c-.8 0-1.5-.7-1.5-1.5V11" />
              <circle cx="8" cy="8" r="2.2" />
            </svg>
          </Action>
          <Action label="Choose a window…" onClick={() => askCanvas("pick")}>
            <svg {...ICON}>
              <rect x="1.5" y="3" width="9" height="7" rx="1.5" />
              <rect x="5.5" y="6" width="9" height="7" rx="1.5" />
            </svg>
          </Action>
          <Action label="Paste image from clipboard" onClick={() => askCanvas("paste")}>
            <svg {...ICON}>
              <rect x="3" y="3" width="10" height="11" rx="1.5" />
              <path d="M6 2.5h4v2H6z" />
            </svg>
          </Action>
          <Action label="Open ScreenForge canvas" onClick={() => showMainWindow().catch(() => {})}>
            <svg {...ICON}>
              <path d="M5 2v12M11 2v12M2 5h12M2 11h12" />
            </svg>
          </Action>
          <div className="my-1.5 h-px w-[22px] bg-line2" />
          <div title={agentLine} className="flex flex-col items-center gap-1 py-1">
            <span className={`h-2 w-2 rounded-full ${pill.connected ? "bg-ok shadow-[0_0_0_3px_var(--ok-soft)]" : "bg-tx3"}`} />
            <span className="font-mono text-[10px] font-semibold text-ag">{instructions ?? "–"}</span>
          </div>
        </div>
      )}

      {mode === "captured" && card && (
        <div className="flex h-full w-full flex-col overflow-hidden rounded-l-xl border border-r-0 border-line2 bg-panel">
          {card.kind === "ok" ? (
            <>
              <div className="grid h-24 flex-none place-items-center border-b border-line bg-panel2">
                <img
                  alt="Capture thumbnail"
                  src={`data:image/png;base64,${card.capture.png_base64}`}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div className="flex flex-1 flex-col gap-2 px-3 py-2.5">
                <div className="flex items-center gap-[7px] font-semibold">
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-ok">
                    <path d="M3.5 8.5l3 3 6-7" />
                  </svg>
                  Captured to canvas
                </div>
                <div className="leading-[1.4] text-tx2">{captureLines(card.capture.window)}</div>
                <textarea
                  rows={2}
                  value={text}
                  placeholder="Tell the agent what to do with it…"
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  onChange={(e) => {
                    setText(e.target.value);
                    sendPillRequest({ kind: "instructions", text: e.target.value }).catch(() => {});
                  }}
                  className="resize-none rounded-[7px] border border-ag-line bg-ag-soft px-[9px] py-[7px] text-xs leading-[1.45] text-tx outline-none"
                />
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      showMainWindow().catch(() => {});
                      dismiss();
                    }}
                    className="h-7 flex-1 rounded-[7px] bg-acc text-xs font-semibold text-acc-tx"
                  >
                    Open in ScreenForge
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      sendPillRequest({ kind: "undo" }).catch(() => {});
                      dismiss();
                    }}
                    className="h-7 rounded-[7px] border border-line2 px-2.5 text-xs font-medium text-tx hover:bg-hover"
                  >
                    Undo
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div role="alert" className="flex flex-1 flex-col justify-center gap-2 bg-warn-soft px-3 text-warn">
              <div className="font-semibold">Capture failed</div>
              <div className="leading-[1.4]">{card.message}</div>
              <button type="button" onClick={dismiss} className="h-7 self-start rounded-[7px] border border-line2 px-2.5 text-tx">
                Close
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
