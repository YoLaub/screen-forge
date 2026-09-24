import { useState } from "react";

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

interface Props {
  windows: WindowInfo[];
  onPick: (w: WindowInfo) => void;
  onCancel: () => void;
}

export default function WindowPicker({ windows, onPick, onCancel }: Props) {
  const [filter, setFilter] = useState("");
  const needle = filter.trim().toLowerCase();
  const shown = windows.filter((w) => captureName(w).toLowerCase().includes(needle));

  return (
    <div
      className="absolute inset-0 z-20 flex items-start justify-center bg-black/20 pt-16"
      onClick={onCancel}
    >
      <div
        className="flex max-h-[70%] w-[28rem] flex-col rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          aria-label="Filter windows"
          placeholder="Capture which window?"
          className="border-b border-neutral-200 px-3 py-2 text-sm focus:outline-none"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onCancel()}
        />
        <div className="overflow-y-auto py-1">
          {shown.length === 0 && (
            <p className="px-3 py-4 text-sm text-neutral-500">
              No window to capture. If windows are missing, give ScreenForge the Screen Recording
              permission in System Settings › Privacy &amp; Security.
            </p>
          )}
          {shown.map((w) => (
            <button
              key={w.id}
              onClick={() => onPick(w)}
              className="flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-left text-sm hover:bg-neutral-100"
            >
              <span className="truncate">{captureName(w)}</span>
              <span className="shrink-0 text-xs text-neutral-400">
                {w.width}×{w.height}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
