import { useEffect, useMemo, useRef, useState } from "react";
import { appTints } from "../theme/tokens";
import { groupWindows, moveActive, sizeLabel } from "./pickerModel";
import { useWindowPreview } from "./useWindowPreview";

/** An OS window, as returned by the `list_windows` command. */
export interface WindowInfo {
  id: number;
  app_name: string;
  title: string;
  width: number;
  height: number;
}

/** Node name for a capture of `w`. */
export function captureName(w: WindowInfo): string {
  return w.title ? `${w.app_name} — ${w.title}` : w.app_name;
}

/** What the dialog shows: listing in progress, the windows, or a missing permission. */
export type PickerState = { status: "loading" } | { status: "list"; windows: WindowInfo[] } | { status: "permission" };

interface Props {
  state: PickerState;
  /** Base64 PNG of a window, for the preview pane. */
  capture: (id: number) => Promise<string>;
  onOpenSettings: () => void;
  /** List the windows again (Try again, Refresh list). */
  onRetry: () => void;
  onPick: (w: WindowInfo) => void;
  onCancel: () => void;
}

const stripes = "bg-[repeating-linear-gradient(135deg,var(--panel2)_0_8px,var(--bg)_8px_16px)]";
const chip = "rounded bg-panel px-[7px] py-[3px] font-mono text-[10.5px] font-medium text-tx3";
const primary = "h-8 rounded-lg bg-acc px-3.5 text-[12.5px] font-semibold text-acc-tx hover:opacity-90";
const secondary = "h-8 rounded-lg border border-line2 px-3.5 text-[12.5px] font-medium text-tx hover:bg-hover";

function Notice({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="grid h-[340px] place-items-center px-[60px]">
      <div className="flex flex-col items-center gap-3 text-center">
        {icon}
        <div className="text-[15px] font-semibold">{title}</div>
        {children}
      </div>
    </div>
  );
}

export default function WindowPicker({ state, capture, onOpenSettings, onRetry, onPick, onCancel }: Props) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const windows = state.status === "list" ? state.windows : [];
  // From the whole list, so an app keeps its color while the list is filtered.
  const tints = useMemo(() => appTints(windows.map((w) => w.app_name)), [windows]);
  const { groups, flat } = groupWindows(windows, query);
  const current = flat[Math.min(active, flat.length - 1)] ?? null;
  const preview = useWindowPreview(current?.id ?? null, capture);
  const activeRow = useRef<HTMLDivElement>(null);
  const searchField = useRef<HTMLInputElement>(null);
  // Try again / Refresh list replace the button that had the focus: give it back to the
  // search field, or Escape, the arrows and Enter would stop reaching the dialog.
  useEffect(() => {
    searchField.current?.focus();
  }, [state.status]);
  useEffect(() => {
    // A block body, not an arrow expression: scrollIntoView returns a Promise in recent
    // Chrome, and React treats whatever an effect returns as its cleanup.
    activeRow.current?.scrollIntoView?.({ block: "nearest" });
  }, [active, query]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onCancel();
    if (state.status !== "list") return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => moveActive(i, flat.length, e.key === "ArrowDown" ? 1 : -1));
    }
    if (e.key === "Enter" && current) onPick(current);
  };

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-scrim" onClick={onCancel}>
      <div
        role="dialog"
        aria-label="Capture a window"
        className="w-[660px] max-w-[calc(100%-32px)] overflow-hidden rounded-[14px] border border-line2 bg-panel text-xs text-tx shadow-dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex h-[52px] items-center gap-2.5 border-b border-line pr-3.5 pl-4">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="flex-none text-tx3">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" />
          </svg>
          <input
            ref={searchField}
            autoFocus
            aria-label="Filter windows"
            placeholder="Capture which window?"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            className="h-9 min-w-0 flex-1 bg-transparent text-[15px] font-medium text-tx outline-none"
          />
          <span className="rounded-[5px] border border-line2 px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-tx3">esc</span>
        </div>

        {state.status === "loading" && (
          <div className="flex h-[340px]">
            <div className="flex w-[300px] flex-none flex-col gap-3.5 border-r border-line p-3.5">
              {[70, 170, 130, 56, 150, 110].map((w, i) => (
                <div key={i} className="flex items-center gap-[9px]">
                  {i % 3 !== 0 && <span className="size-5 rounded-[5px] bg-hover" />}
                  <span className="h-2 rounded bg-hover" style={{ width: w }} />
                </div>
              ))}
            </div>
            <div className="grid flex-1 place-items-center text-tx2">
              <div className="flex items-center gap-[9px]">
                <span className="size-3.5 animate-spin rounded-full border-2 border-line2 border-t-acc" />
                Looking for open windows…
              </div>
            </div>
          </div>
        )}

        {state.status === "permission" && (
          <Notice
            icon={<span className="grid size-10 place-items-center rounded-full bg-warn-soft text-lg font-bold text-warn">!</span>}
            title="Screen Recording permission needed"
          >
            <p className="max-w-[400px] leading-relaxed text-balance text-tx2">
              macOS doesn't let ScreenForge see other windows yet. Turn it on in System Settings → Privacy &amp; Security → Screen Recording,
              then try again. macOS may ask you to reopen ScreenForge first.
            </p>
            <div className="mt-1 flex gap-2">
              <button onClick={onOpenSettings} className={primary}>
                Open Screen Recording settings
              </button>
              <button onClick={onRetry} className={secondary}>
                Try again
              </button>
            </div>
            <p className="text-[11px] text-tx3">You can still paste or drop images onto the canvas.</p>
          </Notice>
        )}

        {state.status === "list" && windows.length === 0 && (
          <Notice icon={<div className="h-[74px] w-[120px] rounded-[9px] border-[1.5px] border-dashed border-line2" />} title="No window to capture.">
            <p className="max-w-[380px] leading-relaxed text-balance text-tx2">
              Open the app you want to show the agent, then try again. Minimized windows and other Spaces aren't listed.
            </p>
            <button onClick={onRetry} className={secondary}>
              Refresh list
            </button>
          </Notice>
        )}

        {state.status === "list" && windows.length > 0 && (
          <div className="flex h-[340px]">
            <div role="listbox" aria-label="Windows" className="flex w-[300px] flex-none flex-col gap-px overflow-auto border-r border-line p-1.5">
              {groups.map((g) => (
                <div key={g.app} role="group" aria-label={g.app} className="flex flex-col gap-px">
                  <div className="px-2 pt-2 pb-1 text-[10.5px] font-semibold text-tx3">{g.app}</div>
                  {g.items.map(({ window: w, index }) => {
                    const isActive = current?.id === w.id;
                    return (
                      <div
                        key={w.id}
                        ref={isActive ? activeRow : undefined}
                        role="option"
                        aria-selected={isActive}
                        aria-label={`${captureName(w)} ${sizeLabel(w)}`}
                        onClick={() => onPick(w)}
                        onMouseEnter={() => setActive(index)}
                        className={`flex h-9 cursor-default items-center gap-[9px] rounded-[7px] px-2 ${isActive ? "bg-acc-soft" : ""}`}
                      >
                        <span
                          className="grid size-5 flex-none place-items-center rounded-[5px] text-[10px] font-semibold text-tint-tx"
                          style={{ background: tints[w.app_name] }}
                        >
                          {w.app_name.charAt(0).toUpperCase()}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-px">
                          <span className="truncate font-medium">{w.title || w.app_name}</span>
                          <span className="font-mono text-[10px] text-tx3">{sizeLabel(w)}</span>
                        </span>
                        {isActive && <span className="font-mono text-[11px] font-medium text-acc">↵</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
              {flat.length === 0 && <div className="px-2.5 py-[18px] leading-normal text-tx3">No window matches “{query}”.</div>}
            </div>
            <div aria-label="Preview" className="flex min-w-0 flex-1 flex-col gap-2.5 p-4">
              <div className={`grid min-h-0 flex-1 place-items-center overflow-hidden rounded-[9px] border border-line ${stripes}`}>
                {preview.status === "ready" && current ? (
                  <img
                    alt={`Preview of ${captureName(current)}`}
                    src={`data:image/png;base64,${preview.png}`}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  preview.status !== "idle" && (
                    <span className={chip}>{preview.status === "failed" ? "Preview unavailable" : "Loading preview…"}</span>
                  )
                )}
              </div>
              {current && (
                <div className="flex flex-col gap-[3px]">
                  <span className="truncate text-[12.5px] font-semibold">{current.title || current.app_name}</span>
                  <span className="text-tx3">
                    {current.app_name} · {sizeLabel(current)}
                  </span>
                </div>
              )}
              <button disabled={!current} onClick={() => current && onPick(current)} className={`${primary} disabled:opacity-40`}>
                Capture to canvas
              </button>
            </div>
          </div>
        )}

        <div className="flex h-[38px] items-center gap-3.5 border-t border-line bg-panel2 px-4 text-[11px] text-tx3">
          <span className="flex items-center gap-[5px]">
            <span className="font-mono text-[10px] font-medium">↑↓</span>navigate
          </span>
          <span className="flex items-center gap-[5px]">
            <span className="font-mono text-[10px] font-medium">↵</span>capture
          </span>
          <span className="flex-1" />
          <span className="flex items-center gap-[5px]">
            From anywhere:
            <span className="rounded border border-line2 px-[5px] py-px font-mono text-[10.5px] font-medium text-tx2">⌘⇧X</span>
            captures the frontmost window
          </span>
        </div>
      </div>
    </div>
  );
}
