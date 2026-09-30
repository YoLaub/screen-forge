import { useState } from "react";
import type { Pt } from "./geometry";

export interface Pin {
  id: string;
  n: number;
  name: string;
  text: string;
  /** Screen positions over the canvas, in pixels. */
  pin: Pt;
  callout: Pt;
}

interface Props {
  pins: Pin[];
  /** Off while one element is selected: the inspector already shows its text. */
  calloutsEnabled: boolean;
  onPick: (id: string) => void;
}

/** Magenta numbered pins over the canvas; display only, never saved or exported. */
export default function InstructionPins({ pins, calloutsEnabled, onPick }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const shown = calloutsEnabled ? pins.find((p) => p.id === hovered) : undefined;
  return (
    <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden">
      {pins.map((p) => (
        <button
          key={p.id}
          title="Instructions for the agent"
          onMouseEnter={() => setHovered(p.id)}
          onMouseLeave={() => setHovered(null)}
          onMouseDownCapture={(e) => e.stopPropagation()}
          onClick={() => onPick(p.id)}
          className="pointer-events-auto absolute grid size-5 place-items-center rounded-[10px_10px_10px_3px] bg-ag text-[10.5px] font-semibold text-ag-tx shadow-pin"
          style={{ left: p.pin.x, top: p.pin.y }}
        >
          {p.n}
        </button>
      ))}
      {shown && (
        <div
          className="absolute flex w-[250px] flex-col gap-1.5 rounded-[10px] border border-ag-line bg-panel px-3 py-2.5 shadow-panel"
          style={{ left: shown.callout.x, top: shown.callout.y }}
        >
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ag">
            <span className="size-[7px] rotate-45 bg-ag" />
            For the agent · {shown.name}
          </div>
          <div className="text-xs leading-[1.45] text-tx">{shown.text}</div>
        </div>
      )}
    </div>
  );
}
