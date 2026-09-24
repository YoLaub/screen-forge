import { useEffect, useState } from "react";
import { type GradientStyle, type NodeStyle, normalizeHex } from "./style";

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

const input =
  "w-full rounded border border-neutral-300 px-2 py-1 text-sm focus:border-neutral-500 focus:outline-none";

function without(style: NodeStyle, ...keys: (keyof NodeStyle)[]): NodeStyle {
  const next = { ...style };
  keys.forEach((k) => delete next[k]);
  return next;
}

/** Native macOS color well plus an exact hex field, applied on Enter or blur. */
function ColorField({ label, value, onColor }: { label: string; value: string; onColor: (hex: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    const hex = normalizeHex(draft);
    if (hex && hex !== value) onColor(hex);
    else setDraft(value);
  };
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label={`${label} picker`}
        className="h-7 w-9 shrink-0 cursor-pointer rounded border border-neutral-300 bg-white"
        value={value.toLowerCase()}
        onChange={(e) => onColor(normalizeHex(e.target.value) ?? value)}
      />
      <input
        aria-label={label}
        className={input}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        onBlur={commit}
      />
    </div>
  );
}

function NumberField({ label, value, min = 0, onValue }: { label: string; value: number; min?: number; onValue: (n: number) => void }) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="text-neutral-500">{label}</span>
      <input
        type="number"
        aria-label={label}
        min={min}
        className={`${input} w-20`}
        value={value}
        onChange={(e) => e.target.value !== "" && onValue(Math.max(min, Number(e.target.value)))}
      />
    </label>
  );
}

type FillMode = "none" | "solid" | "linear" | "radial";

export default function StyleSection({ style, applies, onStyle }: Props) {
  const mode: FillMode = style.gradient ? style.gradient.kind : style.fill ? "solid" : "none";
  const firstColor = style.fill ?? style.gradient?.stops[0]?.color ?? "#E5E7EB";

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
          { offset: 1, color: "#FFFFFF" },
        ],
      };
      onStyle({ ...base, gradient });
    }
  };
  const setStop = (index: number, color: string) => {
    const g = style.gradient!;
    onStyle({ ...style, gradient: { ...g, stops: g.stops.map((s, i) => (i === index ? { ...s, color } : s)) } });
  };

  return (
    <section className="flex flex-col gap-2">
      <span className="font-medium text-neutral-700">Style</span>

      {applies.fill && (
        <>
          <label className="flex items-center justify-between gap-2">
            <span className="text-neutral-500">Fill</span>
            <select aria-label="Fill type" className={`${input} w-36`} value={mode} onChange={(e) => setMode(e.target.value as FillMode)}>
              <option value="none">None</option>
              <option value="solid">Solid</option>
              <option value="linear">Linear gradient</option>
              <option value="radial">Radial gradient</option>
            </select>
          </label>
          {mode === "solid" && <ColorField label="Fill color" value={style.fill!} onColor={(fill) => onStyle({ ...style, fill })} />}
          {style.gradient && (
            <>
              <ColorField label="Gradient start" value={style.gradient.stops[0].color} onColor={(c) => setStop(0, c)} />
              <ColorField label="Gradient end" value={style.gradient.stops[style.gradient.stops.length - 1].color} onColor={(c) => setStop(style.gradient!.stops.length - 1, c)} />
              {style.gradient.kind === "linear" && (
                <NumberField
                  label="Gradient angle"
                  value={style.gradient.angle ?? 90}
                  onValue={(angle) => onStyle({ ...style, gradient: { ...style.gradient!, angle: angle % 360 } })}
                />
              )}
            </>
          )}
        </>
      )}

      <span className="text-neutral-500">Stroke</span>
      <ColorField
        label="Stroke color"
        value={style.stroke ?? "#6B7280"}
        onColor={(stroke) => onStyle({ ...style, stroke, stroke_width: style.stroke_width ?? 1 })}
      />
      <NumberField
        label="Stroke width"
        value={style.stroke ? (style.stroke_width ?? 1) : 0}
        onValue={(w) =>
          onStyle(w === 0 ? without(style, "stroke", "stroke_width") : { ...style, stroke: style.stroke ?? "#6B7280", stroke_width: w })
        }
      />

      {applies.radius && (
        <NumberField
          label="Corner radius"
          value={style.radius ?? 0}
          onValue={(r) => onStyle(r === 0 ? without(style, "radius") : { ...style, radius: r })}
        />
      )}

      {applies.text && (
        <>
          <NumberField label="Font size" value={style.font_size ?? 20} min={1} onValue={(font_size) => onStyle({ ...style, font_size })} />
          <label className="flex items-center justify-between gap-2">
            <span className="text-neutral-500">Font weight</span>
            <select
              aria-label="Font weight"
              className={`${input} w-28`}
              value={style.font_weight === "bold" ? "bold" : "normal"}
              onChange={(e) => onStyle({ ...style, font_weight: e.target.value })}
            >
              <option value="normal">Regular</option>
              <option value="bold">Bold</option>
            </select>
          </label>
        </>
      )}

      <label className="flex items-center justify-between gap-2">
        <span className="text-neutral-500">Opacity</span>
        <input
          type="range"
          aria-label="Opacity"
          min={0}
          max={100}
          value={Math.round((style.opacity ?? 1) * 100)}
          onChange={(e) => {
            const pct = Number(e.target.value);
            onStyle(pct >= 100 ? without(style, "opacity") : { ...style, opacity: pct / 100 });
          }}
        />
      </label>
    </section>
  );
}
