import { useEffect, useRef, useState } from "react";
import { CAPTURE_ICON, CHEVRON, TOOL_ICONS } from "./toolIcons";
import { CUT_HINTS, type CutMode, type GroupChoice, TOOL_GROUPS, type Tool, type ToolGroup, TOOL_META, groupOf, toolTitle } from "./tools";

interface Props {
  tool: Tool;
  choice: GroupChoice;
  cutMode: CutMode;
  onTool: (tool: Tool) => void;
  onCutMode: (mode: CutMode) => void;
  onCapture: () => void;
}

const CUT_MODES: { mode: CutMode; label: string }[] = [
  { mode: "lasso", label: "Lasso" },
  { mode: "line", label: "Line" },
  { mode: "rect", label: "Rectangle" },
  { mode: "ellipse", label: "Ellipse" },
];
const FLYOUT_TITLE: Record<ToolGroup, string> = { shape: "More shapes", line: "Line or arrow" };

function KeyLetter({ letter }: { letter: string }) {
  return <span className="absolute right-[3px] bottom-px font-mono text-[8px] font-medium text-tx3">{letter}</span>;
}

function toolClass(active: boolean) {
  return active ? "bg-acc-soft text-acc" : "text-tx2 hover:bg-hover";
}

const Separator = () => <span className="mx-1 h-5 w-px bg-line2" />;

/** Floating tool bar centered at the top of the canvas (mockup: 8 buttons, groups with flyouts). */
export default function Toolbar({ tool, choice, cutMode, onTool, onCutMode, onCapture }: Props) {
  const [flyout, setFlyout] = useState<ToolGroup | null>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!flyout) return;
    const close = (e: MouseEvent) => {
      if (!flyoutRef.current?.contains(e.target as Node)) setFlyout(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [flyout]);

  const single = (t: Tool) => (
    <button
      key={t}
      onClick={() => onTool(t)}
      aria-pressed={tool === t}
      title={toolTitle(t)}
      aria-label={toolTitle(t)}
      className={`relative grid h-8 w-[34px] place-items-center rounded-[7px] ${toolClass(tool === t)}`}
    >
      {TOOL_ICONS[t]}
      <KeyLetter letter={TOOL_META[t].key} />
    </button>
  );

  const group = (g: ToolGroup) => {
    const shown = choice[g];
    const active = groupOf(tool) === g;
    return (
      <div key={g} className="relative flex" ref={flyout === g ? flyoutRef : undefined}>
        <button
          onClick={() => onTool(shown)}
          aria-pressed={active}
          title={toolTitle(shown)}
          aria-label={toolTitle(shown)}
          className={`relative grid h-8 w-[34px] place-items-center rounded-l-[7px] ${toolClass(active)}`}
        >
          {TOOL_ICONS[shown]}
          <KeyLetter letter={TOOL_META[shown].key} />
        </button>
        <button
          onClick={() => setFlyout(flyout === g ? null : g)}
          title={FLYOUT_TITLE[g]}
          aria-label={FLYOUT_TITLE[g]}
          aria-expanded={flyout === g}
          className={`grid h-8 w-3 place-items-center rounded-r-[7px] p-0 text-tx3 ${active ? "bg-acc-soft" : "hover:bg-hover"}`}
        >
          {CHEVRON}
        </button>
        {flyout === g && (
          <div role="menu" className="absolute top-10 left-0 flex w-[180px] flex-col rounded-[9px] border border-line2 bg-panel p-1 shadow-panel">
            {TOOL_GROUPS[g].map((t) => (
              <button
                key={t}
                role="menuitem"
                onClick={() => {
                  onTool(t);
                  setFlyout(null);
                }}
                className={`flex h-[30px] items-center gap-2 rounded-md px-2 text-left text-xs font-medium text-tx ${tool === t ? "bg-acc-soft" : "hover:bg-hover"}`}
              >
                <span className="flex-1">{TOOL_META[t].label}</span>
                <span className="font-mono text-[10.5px] text-tx3">{TOOL_META[t].key}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="pointer-events-none absolute top-3 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2">
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-[11px] border border-line2 bg-panel p-1 shadow-panel">
        {single("select")}
        {single("frame")}
        <Separator />
        {group("shape")}
        {group("line")}
        {single("cross")}
        {single("pen")}
        {single("text")}
        <Separator />
        {single("cut")}
        <Separator />
        <button
          onClick={onCapture}
          title="Pick a window of this desktop. ⌘⇧X from any app captures the window in front."
          className="flex h-8 items-center gap-[7px] rounded-[7px] bg-acc pr-3 pl-2.5 text-xs font-semibold whitespace-nowrap text-acc-tx hover:opacity-90"
        >
          {CAPTURE_ICON}
          Capture window
        </button>
      </div>
      {tool === "cut" && (
        <div className="pointer-events-auto flex items-center gap-2 rounded-[9px] border border-line2 bg-panel py-1 pr-2.5 pl-1 whitespace-nowrap shadow-panel">
          <div className="flex gap-0.5 rounded-[7px] bg-panel2 p-0.5">
            {CUT_MODES.map(({ mode, label }) => (
              <button
                key={mode}
                onClick={() => onCutMode(mode)}
                aria-pressed={cutMode === mode}
                className={`h-6 rounded-[5px] px-2.5 text-[11.5px] font-medium ${cutMode === mode ? "bg-panel text-tx shadow-sm" : "text-tx2"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-[11.5px] text-tx3">{CUT_HINTS[cutMode]}</span>
        </div>
      )}
    </div>
  );
}
