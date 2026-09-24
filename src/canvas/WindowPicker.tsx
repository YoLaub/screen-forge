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
  /** macOS Screen Recording permission not granted: the OS only lists system windows. */
  permissionMissing?: boolean;
  onOpenSettings?: () => void;
  onPick: (w: WindowInfo) => void;
  onCancel: () => void;
}

export default function WindowPicker({
  windows,
  permissionMissing,
  onOpenSettings,
  onPick,
  onCancel,
}: Props) {
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
          {permissionMissing && (
            <div className="flex flex-col items-start gap-2 px-3 py-4 text-sm text-neutral-600">
              <p>
                The Screen Recording permission is missing, so macOS hides the other apps' windows.
                Grant it, then quit and reopen ScreenForge.
              </p>
              <button
                onClick={onOpenSettings}
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-white hover:bg-neutral-700"
              >
                Open Screen Recording settings
              </button>
            </div>
          )}
          {!permissionMissing && shown.length === 0 && (
            <p className="px-3 py-4 text-sm text-neutral-500">No window to capture.</p>
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
