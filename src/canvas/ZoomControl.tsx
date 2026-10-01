import { zoomLabel } from "./viewport";

interface Props {
  zoom: number;
  onIn: () => void;
  onOut: () => void;
  onFit: () => void;
}

const step = "grid size-[26px] place-items-center rounded-md text-tx2 hover:bg-hover";

/** Bottom-left zoom control: −, percentage, +, Fit all (mockup). */
export default function ZoomControl({ zoom, onIn, onOut, onFit }: Props) {
  return (
    <div className="absolute bottom-3 left-3 z-10 flex items-center gap-0.5 rounded-[9px] border border-line2 bg-panel p-[3px] shadow-panel">
      <button aria-label="Zoom out (⌘−)" title="Zoom out (⌘−)" onClick={onOut} className={step}>
        <svg width="12" height="12" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.6">
          <path d="M3 8h10" />
        </svg>
      </button>
      <span className="w-[42px] text-center font-mono text-[11.5px] font-medium text-tx">{zoomLabel(zoom)}</span>
      <button aria-label="Zoom in (⌘+)" title="Zoom in (⌘+)" onClick={onIn} className={step}>
        <svg width="12" height="12" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.6">
          <path d="M3 8h10M8 3v10" />
        </svg>
      </button>
      <span className="mx-[3px] h-4 w-px bg-line2" />
      <button
        title="Zoom to fit (⇧1)"
        onClick={onFit}
        className="flex h-[26px] items-center gap-1.5 rounded-md px-2 text-[11.5px] font-medium text-tx hover:bg-hover"
      >
        Fit all<span className="font-mono text-[10px] text-tx3">⇧1</span>
      </button>
    </div>
  );
}
