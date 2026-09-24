import { useState } from "react";
import type { LayerRow } from "./layers";

interface Props {
  rows: LayerRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onToggleHidden: (id: string) => void;
  onToggleLocked: (id: string) => void;
  onForward: () => void;
  onBackward: () => void;
}

const KIND_ICON = { frame: "▢", capture: "▣", vector_drawing: "◇" } as const;

const iconButton = "w-6 shrink-0 text-center text-neutral-400 hover:text-neutral-900";

export default function LayersPanel({
  rows,
  selectedId,
  onSelect,
  onRename,
  onToggleHidden,
  onToggleLocked,
  onForward,
  onBackward,
}: Props) {
  const [renaming, setRenaming] = useState<{ id: string; draft: string } | null>(null);

  const commitRename = () => {
    if (renaming && renaming.draft.trim()) onRename(renaming.id, renaming.draft.trim());
    setRenaming(null);
  };

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-neutral-200 bg-white text-sm">
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2">
        <span className="font-medium text-neutral-700">Layers</span>
        <div className="flex gap-1">
          <button
            aria-label="Bring forward"
            title="Bring forward (⌘])"
            disabled={!selectedId}
            onClick={onForward}
            className={`${iconButton} disabled:opacity-30`}
          >
            ↑
          </button>
          <button
            aria-label="Send backward"
            title="Send backward (⌘[)"
            disabled={!selectedId}
            onClick={onBackward}
            className={`${iconButton} disabled:opacity-30`}
          >
            ↓
          </button>
        </div>
      </div>
      <ul className="flex-1 overflow-y-auto py-1">
        {rows.map(({ item, depth }) => (
          <li
            key={item.id}
            className={`flex items-center gap-1 px-2 py-1 ${item.id === selectedId ? "bg-blue-50" : "hover:bg-neutral-50"} ${
              item.hidden ? "text-neutral-400" : "text-neutral-800"
            }`}
            style={{ paddingLeft: 8 + depth * 14 }}
          >
            <span className="w-4 shrink-0 text-neutral-400">{KIND_ICON[item.kind]}</span>
            {renaming?.id === item.id ? (
              <input
                autoFocus
                aria-label={`Rename ${item.name}`}
                className="min-w-0 flex-1 rounded border border-neutral-300 px-1"
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
                className="min-w-0 flex-1 truncate text-left"
                onClick={() => onSelect(item.id)}
                onDoubleClick={() => setRenaming({ id: item.id, draft: item.name })}
              >
                {item.name}
              </button>
            )}
            <button
              aria-label={`${item.hidden ? "Show" : "Hide"} ${item.name}`}
              title={item.hidden ? "Show" : "Hide"}
              onClick={() => onToggleHidden(item.id)}
              className={iconButton}
            >
              {item.hidden ? "◌" : "●"}
            </button>
            <button
              aria-label={`${item.locked ? "Unlock" : "Lock"} ${item.name}`}
              title={item.locked ? "Unlock" : "Lock"}
              onClick={() => onToggleLocked(item.id)}
              className={iconButton}
            >
              {item.locked ? "🔒" : "🔓"}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
