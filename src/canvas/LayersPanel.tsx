import { useState } from "react";
import { type LayerRow, instructionCoverage } from "./layers";
import { LAYER_ICONS } from "./toolIcons";

interface Props {
  rows: LayerRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onToggleHidden: (id: string) => void;
  onToggleLocked: (id: string) => void;
  onForward: () => void;
  onBackward: () => void;
  /** Fold the panel away. */
  onCollapse: () => void;
  /** Float over the canvas (narrow windows) instead of taking a column. */
  floating?: boolean;
}

const headerButton = "grid size-[26px] place-items-center rounded-md text-tx2 hover:bg-hover disabled:opacity-30";
const rowButton = "grid size-5 flex-none place-items-center p-0 text-tx3 hover:text-tx";

export default function LayersPanel({
  rows,
  selectedId,
  onSelect,
  onRename,
  onToggleHidden,
  onToggleLocked,
  onForward,
  onBackward,
  onCollapse,
  floating = false,
}: Props) {
  const [renaming, setRenaming] = useState<{ id: string; draft: string } | null>(null);
  const commitRename = () => {
    if (renaming && renaming.draft.trim()) onRename(renaming.id, renaming.draft.trim());
    setRenaming(null);
  };
  const { covered, total } = instructionCoverage(rows.map((r) => r.item));

  return (
    <aside
      aria-label="Layers"
      data-layout={floating ? "floating" : "docked"}
      className={`flex w-[236px] flex-none flex-col border-r border-line bg-panel text-xs text-tx ${
        floating ? "absolute top-0 bottom-0 left-0 z-30 shadow-panel" : "relative"
      }`}
    >
      <div className="flex h-[38px] flex-none items-center gap-1 pr-2 pl-3.5">
        <span className="flex-1 font-semibold">Layers</span>
        <button aria-label="Hide layers" title="Hide layers (⇧⌘H hides both panels)" onClick={onCollapse} className={headerButton}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
            <rect x="2" y="3" width="12" height="10" rx="1.5" />
            <path d="M6 3v10" />
          </svg>
        </button>
        <button aria-label="Bring forward" title="Bring forward (⌘])" disabled={!selectedId} onClick={onForward} className={headerButton}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 12.5V3.5M4.5 7L8 3.5 11.5 7" />
          </svg>
        </button>
        <button aria-label="Send backward" title="Send backward (⌘[)" disabled={!selectedId} onClick={onBackward} className={headerButton}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 3.5v9M4.5 9L8 12.5 11.5 9" />
          </svg>
        </button>
      </div>
      <ul className="flex flex-1 flex-col gap-px overflow-y-auto pb-2">
        {rows.length === 0 && (
          <li className="mx-3.5 my-[18px] leading-normal text-tx3">No layers yet. Captures, frames and annotations will be listed here.</li>
        )}
        {rows.map(({ item, depth }) => {
          const selected = item.id === selectedId;
          const container = item.kind === "frame" || item.kind === "group";
          return (
            <li
              key={item.id}
              className={`group mx-1.5 flex h-7 flex-none items-center gap-1.5 rounded-md pr-1.5 ${selected ? "bg-acc-soft" : "hover:bg-hover"} ${item.hidden ? "opacity-50" : ""}`}
              style={{ paddingLeft: 6 + depth * 16 }}
            >
              <span className="grid w-2.5 flex-none place-items-center text-tx3">
                {container && (
                  <svg width="8" height="8" viewBox="0 0 8 8">
                    <path d="M1.5 2.5L4 5l2.5-2.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
                  </svg>
                )}
              </span>
              <span data-icon={item.icon} className={`grid size-4 flex-none place-items-center ${selected ? "text-acc" : "text-tx3"}`}>
                {item.icon && LAYER_ICONS[item.icon]}
              </span>
              {renaming?.id === item.id ? (
                <input
                  autoFocus
                  aria-label={`Rename ${item.name}`}
                  className="min-w-0 flex-1 rounded border border-acc bg-panel2 px-1 text-tx outline-none"
                  value={renaming.draft}
                  onChange={(e) => setRenaming({ id: item.id, draft: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") setRenaming(null);
                  }}
                  onBlur={commitRename}
                />
              ) : (
                <button
                  className={`min-w-0 flex-1 truncate text-left ${container ? "font-semibold" : ""}`}
                  onClick={() => onSelect(item.id)}
                  onDoubleClick={() => setRenaming({ id: item.id, draft: item.name })}
                >
                  {item.name}
                </button>
              )}
              {item.instructed && (
                <span title="Has instructions for the agent" className="mr-0.5 size-1.5 flex-none rounded-full bg-ag" />
              )}
              <button
                aria-label={`${item.locked ? "Unlock" : "Lock"} ${item.name}`}
                title={item.locked ? "Unlock" : "Lock"}
                onClick={() => onToggleLocked(item.id)}
                // Like Figma: shown when active, and on hover to act.
                className={`${rowButton} ${item.locked ? "opacity-90" : "opacity-0 group-hover:opacity-60 focus:opacity-60"}`}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="7" width="10" height="7" rx="1.5" />
                  <path d="M5 7V5a3 3 0 0 1 6 0v2" />
                </svg>
              </button>
              <button
                aria-label={`${item.hidden ? "Show" : "Hide"} ${item.name}`}
                title={item.hidden ? "Show" : "Hide"}
                onClick={() => onToggleHidden(item.id)}
                className={`${rowButton} ${item.hidden ? "opacity-90" : "opacity-0 group-hover:opacity-60 focus:opacity-60"}`}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                  <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
                  <circle cx="8" cy="8" r="2" />
                  {item.hidden && <path d="M2.5 2.5l11 11" />}
                </svg>
              </button>
            </li>
          );
        })}
      </ul>
      {total > 0 && (
        <div className="flex flex-none items-center gap-2 border-t border-line px-3.5 py-2.5 text-[11.5px] text-tx2">
          <span className="size-1.5 rounded-full bg-ag" />
          <span>
            <b className="font-semibold text-tx">{covered}</b> of {total} elements have instructions
          </span>
        </div>
      )}
    </aside>
  );
}
