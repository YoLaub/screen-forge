import type { Toast } from "./model";

interface Props {
  toasts: Toast[];
  onClose: (id: number) => void;
}

/** Bottom-center stack over the canvas (mockup); the canvas stays usable around it. */
export default function Toasts({ toasts, onClose }: Props) {
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => {
        const warn = t.kind === "warn";
        return (
          <div
            key={t.id}
            role={warn ? "alert" : "status"}
            className={`pointer-events-auto flex max-w-[560px] items-center gap-2.5 rounded-[10px] border bg-panel py-2 pr-2 pl-3 text-xs text-tx shadow-panel ${warn ? "border-warn" : "border-ok"}`}
          >
            <span
              className={`grid size-[18px] flex-none place-items-center rounded-full text-[11px] font-bold ${warn ? "bg-warn-soft text-warn" : "bg-ok-soft text-ok"}`}
            >
              {warn ? (
                "!"
              ) : (
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M3.5 8.5l3 3 6-7" />
                </svg>
              )}
            </span>
            <span className="flex-none font-semibold">{t.title}</span>
            {t.message && <span className="min-w-0 break-words text-tx2">{t.message}</span>}
            <button
              aria-label="Dismiss"
              onClick={() => onClose(t.id)}
              className="grid size-6 flex-none place-items-center rounded-md text-tx3 hover:bg-hover"
            >
              <svg width="11" height="11" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
