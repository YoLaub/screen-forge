import paper from "paper";
import type { Anchor } from "./penPath";

export type BooleanOp = "union" | "subtract" | "intersect" | "exclude";

export interface BooleanResult {
  /** SVG path data of the result, in the input coordinates. */
  pathData: string;
  /** Editable points when the result is a single closed path. */
  anchors?: Anchor[];
}

let scope: paper.PaperScope | null = null;

/** A Paper.js scope used for geometry only; nothing is ever drawn. */
function getScope(): paper.PaperScope {
  if (!scope) {
    scope = new paper.PaperScope();
    scope.setup(new scope.Size(1, 1));
  }
  return scope;
}

/** The shape of one SVG document as a single path item with transforms applied. */
function shapeOf(s: paper.PaperScope, svg: string): paper.PathItem | null {
  const imported = s.project.importSVG(svg, { insert: false, expandShapes: true });
  const parts = imported.getItems({ class: s.PathItem }) as paper.PathItem[];
  if (imported instanceof s.PathItem) parts.unshift(imported);
  if (parts.length === 0) return null;
  // Bake every transform into the geometry: path data then is in canvas coordinates.
  const shapes = parts.map((p) => {
    const baked = p.clone({ insert: false }) as paper.PathItem;
    baked.transform(p.globalMatrix);
    return baked;
  });
  return shapes.reduce((acc, p) => acc.unite(p, { insert: false }));
}

function anchorsOf(path: paper.Path): Anchor[] {
  return path.segments.map((seg) => {
    const a: Anchor = { x: seg.point.x, y: seg.point.y };
    if (!seg.handleIn.isZero()) a.in = { x: seg.point.x + seg.handleIn.x, y: seg.point.y + seg.handleIn.y };
    if (!seg.handleOut.isZero()) a.out = { x: seg.point.x + seg.handleOut.x, y: seg.point.y + seg.handleOut.y };
    return a;
  });
}

/**
 * Combines shapes given as one SVG document each, bottom of the stack first.
 * `subtract` removes the upper shapes from the bottom one, like Figma.
 * Returns null when nothing is left.
 */
export function booleanShapes(op: BooleanOp, svgs: string[]): BooleanResult | null {
  const s = getScope();
  const shapes = svgs.map((svg) => shapeOf(s, svg)).filter((p): p is paper.PathItem => p !== null);
  if (shapes.length < 2) return null;
  const opts = { insert: false };
  const [bottom, ...rest] = shapes;
  const result =
    op === "subtract"
      ? bottom.subtract(rest.reduce((acc, p) => acc.unite(p, opts)), opts)
      : shapes.reduce((acc, p) =>
          op === "union" ? acc.unite(p, opts) : op === "intersect" ? acc.intersect(p, opts) : acc.exclude(p, opts),
        );
  // Not `area`: the parts of a compound result can have opposite orientations,
  // so their signed areas cancel out (an exclusion reports 0).
  if (result.isEmpty() || result.bounds.width === 0 || result.bounds.height === 0) return null;
  const single = result instanceof s.Path ? result : null;
  return {
    pathData: result.pathData,
    ...(single && single.closed && { anchors: anchorsOf(single) }),
  };
}
