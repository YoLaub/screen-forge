import { dayLabel } from "./dates";
import Logo from "./Logo";
import { shownRecent } from "./recent";
import type { RecentProject } from "./services/backend";

interface Props {
  /** Name of the project being opened: the card shows progress instead of the button. */
  opening?: string;
  onOpen: () => void;
  /** Projects opened before, newest first. */
  recent?: RecentProject[];
  /** Open one of them, by its full path. */
  onOpenRecent?: (path: string) => void;
}

/**
 * Home screen: no project is open yet, or one is loading. Fills the window and keeps
 * a strip at the top for the traffic lights and for dragging the window.
 */
export default function Home({ opening, onOpen, recent = [], onOpenRecent }: Props) {
  const listed = shownRecent(recent);
  const now = Date.now();
  return (
    <div className="flex h-full w-full flex-col bg-bg text-xs text-tx">
      <div data-tauri-drag-region className="h-11 flex-none" />
      <div
        className="grid flex-1 place-items-center"
        style={{ backgroundImage: "radial-gradient(var(--dot) 1px, transparent 1.2px)", backgroundSize: "20px 20px" }}
      >
        <div className="flex w-[440px] max-w-[calc(100%-32px)] flex-col gap-[22px]">
          <div className="flex flex-col items-start gap-3.5">
            <Logo size={48} glow />
            <h1 className="text-[30px] leading-[1.1] font-semibold tracking-[-0.02em]">ScreenForge</h1>
            <p className="text-sm leading-normal text-balance text-tx2">
              Pick the project folder. The canvas is saved in its <span className="font-mono text-[12.5px] text-tx">.screenforge/</span> folder.
            </p>
          </div>
          {opening ? (
            <div
              role="status"
              className="flex h-[84px] items-center gap-3.5 rounded-xl border-[1.5px] border-acc bg-acc-soft px-[18px]"
            >
              <span className="size-[18px] flex-none animate-spin rounded-full border-2 border-line2 border-t-acc" />
              <span className="flex flex-1 flex-col gap-[3px]">
                <span className="text-sm font-semibold">Opening {opening}…</span>
                <span className="text-tx2">Loading the canvas from .screenforge/</span>
              </span>
            </div>
          ) : (
            <button
              aria-label="Open a folder"
              onClick={onOpen}
              className="flex h-[84px] items-center gap-3.5 rounded-xl border-[1.5px] border-dashed border-line2 bg-panel px-[18px] text-left hover:border-acc"
            >
              <span className="grid size-10 flex-none place-items-center rounded-[10px] bg-acc text-acc-tx">
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 4.5c0-.6.4-1 1-1h3.2l1.5 1.6H13c.6 0 1 .4 1 1V12c0 .6-.4 1-1 1H3c-.6 0-1-.4-1-1z" />
                </svg>
              </span>
              <span className="flex-1 text-sm font-semibold">Open a folder</span>
              <span className="rounded-[5px] border border-line2 px-1.5 py-0.5 font-mono text-[11px] font-medium text-tx3">⌘O</span>
            </button>
          )}
          {listed.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <div className="px-2.5 pb-1.5 text-[11px] font-semibold text-tx3">Recent</div>
              {listed.map((r) => (
                <button
                  key={r.path}
                  disabled={!!opening}
                  onClick={() => onOpenRecent?.(r.path)}
                  title={r.path}
                  className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-left enabled:hover:bg-hover disabled:opacity-60"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="flex-none text-tx3">
                    <path d="M2 4.5c0-.6.4-1 1-1h3.2l1.5 1.6H13c.6 0 1 .4 1 1V12c0 .6-.4 1-1 1H3c-.6 0-1-.4-1-1z" />
                  </svg>
                  <span className="flex-none font-medium">{r.name}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-tx3">{r.display}</span>
                  <span className="flex-none text-[11px] text-tx3">{dayLabel(r.opened_ms, now)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
