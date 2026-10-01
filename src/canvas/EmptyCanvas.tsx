interface Props {
  onCapture: () => void;
}

const kbd = "rounded border border-line2 px-[5px] py-px font-mono text-[10.5px] font-medium text-tx3";

/** Shown over an empty, loaded canvas; clicks fall through to the canvas around the buttons. */
export default function EmptyCanvas({ onCapture }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[4] grid place-items-center">
      <div className="flex w-[360px] flex-col items-center gap-3.5 text-center text-xs">
        <div className="grid h-[130px] w-[220px] place-items-center rounded-xl border-[1.5px] border-dashed border-line2 text-tx3">
          <svg width="26" height="26" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
            <rect x="2" y="3" width="12" height="10" rx="1.5" />
            <circle cx="6" cy="7" r="1.2" />
            <path d="M2.5 12l4-3.5 3 2.5 2-1.5 2.5 2" />
          </svg>
        </div>
        <div className="text-[15px] font-semibold text-tx">Show the agent something</div>
        <div className="leading-normal text-balance text-tx2">
          Capture any window on your Mac, or paste / drop an image here. Then annotate it and tell the agent what to do.
        </div>
        <div className="pointer-events-auto flex gap-2">
          <button
            onClick={onCapture}
            className="flex h-8 items-center rounded-lg bg-acc px-3 text-[12.5px] font-semibold text-acc-tx hover:opacity-90"
          >
            Capture window
          </button>
          <div className="flex h-8 items-center gap-1.5 px-2.5 text-tx2">
            or paste <span className={kbd}>⌘V</span>
          </div>
        </div>
        <div className="text-[11px] text-tx3">
          Tip: <span className="font-mono text-[10.5px]">⌘⇧X</span> captures the frontmost window from anywhere.
        </div>
      </div>
    </div>
  );
}
