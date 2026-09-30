import Logo from "./Logo";
import { type AgentPill, savedLabel } from "./titleBarState";

interface Props {
  folder: string;
  path: string;
  onChangeFolder: () => void;
  saved: Date | null;
  agent: AgentPill | null;
  onAgent: () => void;
  exportLabel: string | null;
  onExport: () => void;
}

/**
 * 44 px bar holding the macOS traffic lights (the native title bar is an overlay):
 * project, save state, agent state and the Export action. Empty space drags the window.
 */
export default function TitleBar({ folder, path, onChangeFolder, saved, agent, onAgent, exportLabel, onExport }: Props) {
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
        <button
          onClick={onExport}
          className="flex h-7 items-center gap-1.5 rounded-[7px] bg-acc px-[11px] font-semibold text-acc-tx hover:opacity-90"
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M8 10V2.5M4.8 5.5L8 2.3l3.2 3.2M2.5 10.5v2c0 .6.4 1 1 1h9c.6 0 1-.4 1-1v-2" />
          </svg>
          {exportLabel}
        </button>
      )}
    </header>
  );
}
