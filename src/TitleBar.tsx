import Logo from "./Logo";
import type { AgentRead } from "./agentRead";
import type { AgentStatus } from "./AgentSetup";
import { agentPill, savedLabel } from "./titleBarState";
import { useEffect, useState } from "react";
import { EXPORT_FORMATS, EXPORT_QUALITIES, type ExportFormat, type ExportQuality, type ExportSettings, usesQuality } from "./canvas/exportOptions";
import { useNow } from "./useNow";

const FORMAT_LABEL: Record<ExportFormat, string> = { png: "PNG", jpg: "JPG", webp: "WebP" };
const QUALITY_LABEL: Record<ExportQuality, string> = { low: "Low", medium: "Medium", high: "High" };

function Segments<T extends string>({
  values,
  labels,
  current,
  disabled,
  onPick,
}: {
  values: T[];
  labels: Record<T, string>;
  current: T;
  disabled?: boolean;
  onPick: (value: T) => void;
}) {
  return (
    <div className={`flex gap-0.5 rounded-lg bg-panel2 p-0.5 ${disabled ? "opacity-50" : ""}`}>
      {values.map((v) => (
        <button
          key={v}
          type="button"
          disabled={disabled}
          aria-pressed={v === current}
          onClick={() => onPick(v)}
          className={`h-6 flex-1 rounded-md px-2.5 text-xs font-medium ${v === current ? "bg-panel text-tx shadow-panel" : "text-tx2 hover:text-tx"}`}
        >
          {labels[v]}
        </button>
      ))}
    </div>
  );
}

interface Props {
  folder: string;
  path: string;
  onChangeFolder: () => void;
  saved: Date | null;
  agentStatus: AgentStatus | null;
  /** The latest read of the canvas by an agent, for the pill's note. */
  lastRead: AgentRead | null;
  onAgent: () => void;
  exportLabel: string | null;
  onExport: () => void;
  exportSettings: ExportSettings;
  onExportSettings: (settings: ExportSettings) => void;
}

/**
 * 44 px bar holding the macOS traffic lights (the native title bar is an overlay):
 * project, save state, agent state and the Export action. Empty space drags the window.
 */
export default function TitleBar({ folder, path, onChangeFolder, saved, agentStatus, lastRead, onAgent, exportLabel, onExport, exportSettings, onExportSettings }: Props) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  useEffect(() => {
    if (!optionsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOptionsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [optionsOpen]);
  // Renewed here, not in App, so the minutes moving on redraw the title bar only.
  const now = useNow();
  const agent = agentStatus && agentPill(agentStatus, lastRead, now);
  return (
    <header
      data-tauri-drag-region
      className="flex h-11 flex-none items-center gap-3.5 border-b border-line bg-bg pr-3 pl-[86px] text-xs text-tx"
    >
      <Logo />
      <button
        title="Change folder"
        onClick={onChangeFolder}
        className="flex h-7 flex-none items-center gap-[7px] rounded-[7px] px-2 text-[13px] font-semibold whitespace-nowrap hover:bg-hover"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="text-tx2">
          <path d="M2 4.5c0-.6.4-1 1-1h3.2l1.5 1.6H13c.6 0 1 .4 1 1V12c0 .6-.4 1-1 1H3c-.6 0-1-.4-1-1z" />
        </svg>
        <span title={path}>{folder}</span>
        <svg width="9" height="9" viewBox="0 0 8 8" className="text-tx3">
          <path d="M1.5 2.8L4 5.3l2.5-2.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      </button>
      {saved && (
        <span data-tauri-drag-region className="flex flex-none items-center gap-[5px] text-[11.5px] whitespace-nowrap text-tx3">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M3.5 8.5l3 3 6-7" />
          </svg>
          {savedLabel(saved)}
        </span>
      )}
      <span data-tauri-drag-region className="flex-1 self-stretch" />
      {agent?.connected ? (
        <button
          onClick={onAgent}
          aria-label={`${agent.client} ${agent.note}`}
          className="flex h-7 items-center gap-2 rounded-full border border-line2 bg-panel pr-2.5 pl-[9px] font-medium hover:border-ok"
        >
          <span className="size-[7px] rounded-full bg-ok ring-3 ring-ok-soft" />
          {agent.client}
          <span className="font-normal text-tx3">{agent.note}</span>
        </button>
      ) : (
        <button
          onClick={onAgent}
          className="flex h-7 items-center gap-[7px] rounded-full border border-acc px-[11px] font-semibold text-acc"
        >
          <span className="size-[7px] rounded-full border-[1.5px] border-acc" />
          Connect AI
        </button>
      )}
      {exportLabel && (
        <div className="relative flex">
          <button
            onClick={onExport}
            className="flex h-7 items-center gap-1.5 rounded-l-[7px] bg-acc px-[11px] font-semibold text-acc-tx hover:opacity-90"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M8 10V2.5M4.8 5.5L8 2.3l3.2 3.2M2.5 10.5v2c0 .6.4 1 1 1h9c.6 0 1-.4 1-1v-2" />
            </svg>
            {exportLabel}
            <span className="font-mono text-[10px] font-medium opacity-75">{FORMAT_LABEL[exportSettings.format]}</span>
          </button>
          <button
            type="button"
            aria-label="Export options"
            aria-expanded={optionsOpen}
            onClick={() => setOptionsOpen((open) => !open)}
            className="grid h-7 w-6 place-items-center rounded-r-[7px] border-l border-acc-tx/25 bg-acc text-acc-tx hover:opacity-90"
          >
            <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6l5 5 5-5" />
            </svg>
          </button>
          {optionsOpen && (
            <div className="absolute right-0 top-9 z-50 flex w-[236px] flex-col gap-2.5 rounded-[11px] border border-line2 bg-panel p-3 shadow-panel">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-tx3">Format</div>
              <Segments
                values={EXPORT_FORMATS}
                labels={FORMAT_LABEL}
                current={exportSettings.format}
                onPick={(format) => onExportSettings({ ...exportSettings, format })}
              />
              <div className="text-[11px] font-semibold uppercase tracking-wide text-tx3">Quality</div>
              <Segments
                values={EXPORT_QUALITIES}
                labels={QUALITY_LABEL}
                current={exportSettings.quality}
                disabled={!usesQuality(exportSettings.format)}
                onPick={(quality) => onExportSettings({ ...exportSettings, quality })}
              />
              {!usesQuality(exportSettings.format) && (
                <div className="text-[11px] leading-snug text-tx3">PNG keeps every pixel: quality applies to JPG and WebP.</div>
              )}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
