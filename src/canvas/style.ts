/** Style block of sf-core's node.json, in CSS-like terms for the agent. */
export interface GradientStyle {
  kind: "linear" | "radial";
  /** CSS direction in degrees (90 = left to right); linear only. */
  angle?: number;
  stops: { offset: number; color: string }[];
}

export interface NodeStyle {
  fill?: string;
  stroke?: string;
  stroke_width?: number;
  radius?: number;
  opacity?: number;
  gradient?: GradientStyle;
  font_size?: number;
  font_weight?: string;
}

/** Gradient coordinates in `percentage` units (0 to 1 over the object). */
export interface Coords {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** What `readStyle` needs from a Fabric object. */
export interface StyledLike {
  fill?: string | { type: string; coords: Coords; colorStops: { offset: number; color: string }[] } | null;
  stroke?: string | null;
  strokeWidth?: number;
  rx?: number;
  opacity?: number;
  fontSize?: number;
  fontWeight?: string | number;
}

const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, "0");

/** `#RRGGBB` for a user entry or a Fabric color, or null when it is not a color. */
export function normalizeHex(input: string): string | null {
  const s = input.trim();
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(s);
  if (rgb) return `#${hex2(+rgb[1])}${hex2(+rgb[2])}${hex2(+rgb[3])}`.toUpperCase();
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (!hex) return null;
  const digits = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1];
  return `#${digits.toUpperCase()}`;
}

/** Coordinates of a linear gradient running in CSS direction `angle`. */
export function linearCoords(angle: number): Coords {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.sin(rad) / 2;
  const dy = -Math.cos(rad) / 2;
  return { x1: 0.5 - dx, y1: 0.5 - dy, x2: 0.5 + dx, y2: 0.5 + dy };
}

/** CSS direction in whole degrees (0 to 359) of linear gradient coordinates. */
export function angleOf(c: Coords): number {
  const deg = (Math.atan2(c.x2 - c.x1, -(c.y2 - c.y1)) * 180) / Math.PI;
  return Math.round((deg + 360) % 360);
}

/** The node's style; `radius` and `text` say which properties apply to it. */
export function readStyle(o: StyledLike, applies: { radius: boolean; text: boolean }): NodeStyle {
  const style: NodeStyle = {};
  if (typeof o.fill === "string") {
    const fill = normalizeHex(o.fill);
    if (fill) style.fill = fill;
  } else if (o.fill && (o.fill.type === "linear" || o.fill.type === "radial")) {
    style.gradient = {
      kind: o.fill.type,
      ...(o.fill.type === "linear" && { angle: angleOf(o.fill.coords) }),
      stops: [...o.fill.colorStops]
        .sort((a, b) => a.offset - b.offset)
        .map((s) => ({ offset: s.offset, color: normalizeHex(s.color) ?? s.color })),
    };
  }
  const stroke = o.stroke ? normalizeHex(o.stroke) : null;
  if (stroke && (o.strokeWidth ?? 0) > 0) {
    style.stroke = stroke;
    style.stroke_width = o.strokeWidth;
  }
  if (applies.radius && (o.rx ?? 0) > 0) style.radius = o.rx;
  if (o.opacity !== undefined && o.opacity < 1) style.opacity = Math.round(o.opacity * 100) / 100;
  if (applies.text) {
    if (o.fontSize) style.font_size = o.fontSize;
    if (o.fontWeight !== undefined) style.font_weight = String(o.fontWeight);
  }
  return style;
}

/** Every color of a style once, in order: fill, stroke, gradient stops. */
export function colorsOf(style: NodeStyle): string[] {
  const all = [style.fill, style.stroke, ...(style.gradient?.stops.map((s) => s.color) ?? [])];
  return [...new Set(all.filter((c): c is string => !!c))];
}

/** A Fabric gradient definition (`new Gradient(spec)`), in percentage units. */
export interface GradientSpec {
  type: "linear" | "radial";
  gradientUnits: "percentage";
  coords: Coords & { r1?: number; r2?: number };
  colorStops: { offset: number; color: string }[];
}

export interface FabricStyleProps {
  fill: string | GradientSpec;
  stroke: string;
  strokeWidth: number;
  rx?: number;
  ry?: number;
  opacity: number;
  fontSize?: number;
  fontWeight?: string;
}

/** Fabric properties that render `style`; unset parts are cleared, not kept. */
export function toFabricProps(style: NodeStyle, applies: { radius: boolean; text: boolean }): FabricStyleProps {
  const g = style.gradient;
  const fill: string | GradientSpec = g
    ? {
        type: g.kind,
        gradientUnits: "percentage",
        coords:
          g.kind === "linear"
            ? linearCoords(g.angle ?? 90)
            : { x1: 0.5, y1: 0.5, x2: 0.5, y2: 0.5, r1: 0, r2: 0.5 },
        colorStops: g.stops,
      }
    : (style.fill ?? "");
  return {
    fill,
    stroke: style.stroke ?? "",
    strokeWidth: style.stroke ? (style.stroke_width ?? 1) : 0,
    ...(applies.radius && { rx: style.radius ?? 0, ry: style.radius ?? 0 }),
    opacity: style.opacity ?? 1,
    ...(applies.text && { fontSize: style.font_size ?? 20, fontWeight: style.font_weight ?? "normal" }),
  };
}
