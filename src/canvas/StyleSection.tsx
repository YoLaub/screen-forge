import { useEffect, useState } from "react";
import { DRAWING } from "./drawingDefaults";
import { type GradientStyle, type NodeStyle, normalizeHex } from "./style";

const DEFAULT_FILL = normalizeHex(DRAWING.shapeFill)!;
const DEFAULT_STROKE = normalizeHex(DRAWING.shapeStroke)!;

/** Which style properties apply to the selected node. */
export interface StyleApplies {
  fill: boolean;
  radius: boolean;
  text: boolean;
}

interface Props {
  style: NodeStyle;
  applies: StyleApplies;
  onStyle: (next: NodeStyle) => void;
}

const box = "flex h-[26px] min-w-0 items-center gap-[7px] rounded-md border border-line bg-panel2 px-[7px]";
const mono = "min-w-0 flex-1 bg-transparent font-mono text-[11px] text-tx outline-none";

function without(style: NodeStyle, ...keys: (keyof NodeStyle)[]): NodeStyle {
  const next = { ...style };
  keys.forEach((k) => delete next[k]);
  return next;
}

/** Swatch (native macOS color well) plus an exact hex field, applied on Enter or blur. */
function ColorField({ label, value, onColor }: { label: string; value: string; onColor: (hex: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    const hex = normalizeHex(draft);
    if (hex && hex !== value) onColor(hex);
    else setDraft(value);
  };
  return (
    <div className={box}>
      <input
        type="color"
        aria-label={`${label} picker`}
        className="size-3.5 flex-none cursor-pointer rounded border-0 bg-transparent p-0"
        value={value.toLowerCase()}
        onChange={(e) => onColor(normalizeHex(e.target.value) ?? value)}
      />
      <input
        aria-label={label}
        className={mono}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        onBlur={commit}
      />
    </div>
  );
}

function NumberField({ label, value, min = 0, prefix, onValue }: { label: string; value: number; min?: number; prefix?: string; onValue: (n: number) => void }) {
  return (
    <label className={box} title={label}>
      {prefix && <span className="font-mono text-[11px] text-tx3">{prefix}</span>}
      <input
        type="number"
        aria-label={label}
        min={min}
        className={mono}
        value={value}
        onChange={(e) => e.target.value !== "" && onValue(Math.max(min, Number(e.target.value)))}
      />
    </label>
  );
}

/** Segmented control: one pressed button per option. */
function Segments<T extends string>({ options, value, onPick }: { options: [T, string][]; value: T; onPick: (v: T) => void }) {
  return (
    <div className="flex gap-px rounded-[7px] bg-panel2 p-0.5">
      {options.map(([id, label]) => (
        <button
          key={id}
          aria-pressed={value === id}
          onClick={() => onPick(id)}
          className={`h-[22px] flex-1 rounded-[5px] text-[11px] font-medium ${value === id ? "bg-panel text-tx shadow-sm" : "text-tx2"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

type FillMode = "none" | "solid" | "linear" | "radial";

export default function StyleSection({ style, applies, onStyle }: Props) {
  const mode: FillMode = style.gradient ? style.gradient.kind : style.fill ? "solid" : "none";
  const firstColor = style.fill ?? style.gradient?.stops[0]?.color ?? DEFAULT_FILL;
  const opacity = Math.round((style.opacity ?? 1) * 100);

  const setMode = (next: FillMode) => {
    const base = without(style, "fill", "gradient");
    if (next === "solid") onStyle({ ...base, fill: firstColor });
    else if (next === "none") onStyle(base);
    else {
      const gradient: GradientStyle = {
        kind: next,
        ...(next === "linear" && { angle: style.gradient?.angle ?? 90 }),
        stops: style.gradient?.stops ?? [
          { offset: 0, color: firstColor },
          { offset: 1, color: DRAWING.gradientEnd },
        ],
      };
      onStyle({ ...base, gradient });
    }
  };
  const setStop = (index: number, color: string) => {
    const g = style.gradient!;
    onStyle({ ...style, gradient: { ...g, stops: g.stops.map((s, i) => (i === index ? { ...s, color } : s)) } });
  };
  const Label = ({ children }: { children: string }) => <span>{children}</span>;

  return (
    <div className="grid grid-cols-[78px_minmax(0,1fr)] items-center gap-x-2 gap-y-[9px] text-[11.5px] text-tx2">
      {applies.text ? (
        <>
          <Label>Color</Label>
          <ColorField label="Text color" value={style.fill ?? DEFAULT_STROKE} onColor={(fill) => onStyle({ ...style, fill })} />
          <Label>Font size</Label>
          <NumberField label="Font size" value={style.font_size ?? 20} min={1} onValue={(font_size) => onStyle({ ...style, font_size })} />
          <Label>Weight</Label>
          <Segments
            options={[["normal", "Regular"], ["bold", "Bold"]]}
            value={style.font_weight === "bold" ? "bold" : "normal"}
            onPick={(font_weight) => onStyle({ ...style, font_weight })}
          />
        </>
      ) : (
        <>
          {applies.fill && (
            <>
              <Label>Fill</Label>
              <Segments
                options={[["none", "None"], ["solid", "Solid"], ["linear", "Linear"], ["radial", "Radial"]]}
                value={mode}
                onPick={setMode}
              />
              {mode === "solid" && (
                <>
                  <span />
                  <ColorField label="Fill color" value={style.fill!} onColor={(fill) => onStyle({ ...style, fill })} />
                </>
              )}
              {style.gradient && (
                <>
                  <span />
                  <ColorField label="Gradient start" value={style.gradient.stops[0].color} onColor={(c) => setStop(0, c)} />
                  <span />
                  <ColorField
                    label="Gradient end"
                    value={style.gradient.stops[style.gradient.stops.length - 1].color}
                    onColor={(c) => setStop(style.gradient!.stops.length - 1, c)}
                  />
                  {style.gradient.kind === "linear" && (
                    <>
                      <Label>Angle</Label>
                      <NumberField
                        label="Gradient angle"
                        value={style.gradient.angle ?? 90}
                        onValue={(angle) => onStyle({ ...style, gradient: { ...style.gradient!, angle: angle % 360 } })}
                      />
                    </>
                  )}
                </>
              )}
            </>
          )}
          <Label>Stroke</Label>
          <div className="flex gap-1.5">
            <div className="min-w-0 flex-1">
              <ColorField
                label="Stroke color"
                value={style.stroke ?? DEFAULT_STROKE}
                onColor={(stroke) => onStyle({ ...style, stroke, stroke_width: style.stroke_width ?? 1 })}
              />
            </div>
            <div className="w-[60px]">
              <NumberField
                label="Stroke width"
                prefix="W"
                value={style.stroke ? (style.stroke_width ?? 1) : 0}
                onValue={(w) =>
                  onStyle(w === 0 ? without(style, "stroke", "stroke_width") : { ...style, stroke: style.stroke ?? DEFAULT_STROKE, stroke_width: w })
                }
              />
            </div>
          </div>
          {applies.radius && (
            <>
              <Label>Corner radius</Label>
              <NumberField
                label="Corner radius"
                value={style.radius ?? 0}
                onValue={(r) => onStyle(r === 0 ? without(style, "radius") : { ...style, radius: r })}
              />
            </>
          )}
        </>
      )}
      <Label>Opacity</Label>
      <div className="flex items-center gap-2">
        <input
          type="range"
          aria-label="Opacity"
          min={0}
          max={100}
          value={opacity}
          className="min-w-0 flex-1 accent-acc"
          onChange={(e) => {
            const pct = Number(e.target.value);
            onStyle(pct >= 100 ? without(style, "opacity") : { ...style, opacity: pct / 100 });
          }}
        />
        <span className="w-[34px] text-right font-mono text-[11px] text-tx">{opacity}%</span>
      </div>
    </div>
  );
}
