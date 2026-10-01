interface Props {
  label: "Layers" | "Inspector";
  side: "left" | "right";
  onClick: () => void;
}

/** Button at the edge of the canvas that brings back a folded (or floating) side panel. */
export default function PanelOpener({ label, side, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      // A press here must not count as a click on the canvas (which closes a floating panel).
      onMouseDownCapture={(e) => e.stopPropagation()}
      title={`Show ${label.toLowerCase()} (⇧⌘H shows both panels)`}
      className={`absolute top-3 z-20 flex h-[34px] items-center gap-1.5 rounded-[9px] border border-line2 bg-panel px-[11px] text-xs font-medium text-tx shadow-panel hover:bg-hover ${
        side === "left" ? "left-3" : "right-3"
      }`}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <rect x="2" y="3" width="12" height="10" rx="1.5" />
        <path d={side === "left" ? "M6 3v10" : "M10 3v10"} />
      </svg>
      {label}
    </button>
  );
}
