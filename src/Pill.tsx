import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { AgentStatus } from "./AgentSetup";
import Logo from "./Logo";
import { agentTooltip, captureLines, nextMode, type PillEvent, type PillMode, shouldAutoDismiss } from "./pillState";
import { groupWindows } from "./canvas/pickerModel";
import type { WindowInfo } from "./canvas/WindowPicker";
import {
  agentStatus,
  captureChosen,
  captureFront,
  ensureScreenCaptureAccess,
  listWindows,
  openScreenCaptureSettings,
  onCanvasSummary,
  onCaptured,
  onCaptureFailed,
  pillSetState,
  pillSetTop,
  regionBegin,
  sendPillRequest,
  type ShortcutCapture,
  showMainWindow,
} from "./services/backend";
import { agentPill } from "./titleBarState";
import { BRAND } from "./theme/tokens";

type Listing = { status: "loading" } | { status: "list"; windows: WindowInfo[] } | { status: "permission" };

type Card = { kind: "ok"; capture: ShortcutCapture } | { kind: "error"; message: string };

/** The card goes away by itself after this long when nobody touched it. */
const CARD_MS = 10_000;

function Action({
  label,
  hint,
  detail,
  primary,
  busy,
  onClick,
  children,
}: {
  label: string;
  hint?: string;
  /** One line saying what the action does, shown under the label. */
  detail: string;
  primary?: boolean;
  busy?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-[9px] px-2 py-1.5 text-left ${primary ? "bg-acc text-acc-tx" : "text-tx hover:bg-hover"}`}
    >
      <span className="grid h-6 w-6 flex-none place-items-center">
        {busy ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70" />
        ) : (
          children
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="flex items-center justify-between gap-2 font-semibold">
          {label}
          {hint && <span className="font-mono text-[10px] font-medium opacity-70">{hint}</span>}
        </span>
        <span className={`text-[11px] ${primary ? "opacity-80" : "text-tx3"}`}>{detail}</span>
      </span>
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
  const [listing, setListing] = useState<Listing>({ status: "loading" });
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
      if (e.key === "Escape" && (modeRef.current === "captured" || modeRef.current === "picking")) dismiss();
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

  async function startRegion() {
    try {
      await regionBegin();
    } catch (error) {
      setCard({ kind: "error", message: String(error) });
      go("captured");
    }
  }

  async function askPaste() {
    await showMainWindow();
    await sendPillRequest({ kind: "paste" });
  }

  // The list is made here, not in the main window: windows are listed for the desktop
  // we are on, and bringing the main window forward could switch to another one.
  async function startPicking() {
    setListing({ status: "loading" });
    go("pick");
    try {
      const granted = await ensureScreenCaptureAccess();
      setListing(granted ? { status: "list", windows: await listWindows() } : { status: "permission" });
    } catch (error) {
      dismiss();
      setCard({ kind: "error", message: String(error) });
      go("captured");
    }
  }

  async function pickWindow(w: WindowInfo) {
    setBusy(true);
    try {
      await captureChosen(w.id);
    } catch (error) {
      setBusy(false);
      setCard({ kind: "error", message: String(error) });
      go("captured");
    }
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
        <div className="flex h-full w-full flex-col gap-0.5 rounded-l-[14px] border border-r-0 border-line2 bg-panel px-2 pb-2 pt-1.5">
          <div
            title="Drag to move up or down"
            onMouseDown={startDrag}
            className="flex cursor-ns-resize items-center gap-2 px-1 pb-1.5 pt-1"
          >
            <Logo size={20} />
            <span className="flex-1 font-semibold">ScreenForge</span>
            <span className="h-[3px] w-[18px] rounded-sm bg-line2" />
          </div>
          <Action
            label="Capture frontmost window"
            hint="⌘⇧X"
            detail="Adds the window in front to the canvas"
            primary
            busy={busy}
            onClick={capture}
          >
            <svg {...ICON}>
              <path d="M2 5V3.5c0-.8.7-1.5 1.5-1.5H5M11 2h1.5c.8 0 1.5.7 1.5 1.5V5M14 11v1.5c0 .8-.7 1.5-1.5 1.5H11M5 14H3.5c-.8 0-1.5-.7-1.5-1.5V11" />
              <circle cx="8" cy="8" r="2.2" />
            </svg>
          </Action>
          <Action label="Choose a window…" detail="Lists the windows on this desktop" onClick={startPicking}>
            <svg {...ICON}>
              <rect x="1.5" y="3" width="9" height="7" rx="1.5" />
              <rect x="5.5" y="6" width="9" height="7" rx="1.5" />
            </svg>
          </Action>
          <Action label="Capture a region" detail="Draw a rectangle or an outline on the screen" onClick={startRegion}>
            <svg {...ICON}>
              <path d="M2 5.5V3.5C2 2.7 2.7 2 3.5 2h2M10.5 2h2c.8 0 1.5.7 1.5 1.5v2M14 10.5v2c0 .8-.7 1.5-1.5 1.5h-2M5.5 14h-2C2.7 14 2 13.3 2 12.5v-2" strokeDasharray="2 2" />
              <path d="M6 8h4M8 6v4" />
            </svg>
          </Action>
          <Action label="Paste image from clipboard" detail="Adds the copied image to the canvas" onClick={() => askPaste()}>
            <svg {...ICON}>
              <rect x="3" y="3" width="10" height="11" rx="1.5" />
              <path d="M6 2.5h4v2H6z" />
            </svg>
          </Action>
          <Action label="Open ScreenForge canvas" detail="Shows the main window" onClick={() => showMainWindow().catch(() => {})}>
            <svg {...ICON}>
              <path d="M5 2v12M11 2v12M2 5h12M2 11h12" />
            </svg>
          </Action>
          <div className="my-1 h-px bg-line2" />
          <div className="flex items-center gap-2 px-2 py-1 text-[11px] text-tx2">
            <span className={`h-2 w-2 flex-none rounded-full ${pill.connected ? "bg-ok shadow-[0_0_0_3px_var(--ok-soft)]" : "bg-tx3"}`} />
            <span className="flex-1 leading-tight">{agentLine}</span>
          </div>
        </div>
      )}

      {mode === "picking" && (
        <div className="flex h-full w-full flex-col overflow-hidden rounded-l-xl border border-r-0 border-line2 bg-panel">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="font-semibold">Capture which window?</span>
            <button type="button" aria-label="Close" onClick={dismiss} className="grid h-6 w-6 place-items-center rounded-md text-tx3 hover:bg-hover">
              <svg width="11" height="11" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.7">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5">
            {listing.status === "loading" && <div className="px-2 py-3 text-tx3">Looking for open windows…</div>}
            {listing.status === "permission" && (
              <div className="flex flex-col gap-2 px-2 py-3">
                <div className="font-semibold">Screen Recording permission needed</div>
                <button
                  type="button"
                  onClick={() => openScreenCaptureSettings().catch(() => {})}
                  className="h-7 self-start rounded-[7px] bg-acc px-2.5 font-semibold text-acc-tx"
                >
                  Open Screen Recording settings
                </button>
                <button type="button" onClick={startPicking} className="h-7 self-start rounded-[7px] border border-line2 px-2.5 text-tx">
                  Try again
                </button>
              </div>
            )}
            {listing.status === "list" && listing.windows.length === 0 && (
              <div className="px-2 py-3 text-tx3">No window to capture on this desktop.</div>
            )}
            {listing.status === "list" &&
              groupWindows(listing.windows, "").groups.map((g) => (
                <div key={g.app} className="mb-1">
                  <div className="px-2 pb-0.5 pt-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-tx3">{g.app}</div>
                  {g.items.map(({ window: w }) => (
                    <button
                      key={w.id}
                      type="button"
                      disabled={busy}
                      onClick={() => pickWindow(w)}
                      className="flex w-full flex-col rounded-[7px] px-2 py-1 text-left leading-tight hover:bg-hover"
                    >
                      <span className="sr-only">{w.app_name}</span>
                      <span className="truncate font-medium">{w.title || w.app_name}</span>
                      <span className="font-mono text-[10px] text-tx3">
                        {w.width} × {w.height}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
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
