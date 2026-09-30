import {
  ActiveSelection,
  Canvas,
  Ellipse,
  FabricImage,
  FabricObject,
  FabricText,
  Gradient,
  IText,
  Circle,
  Line,
  Path,
  Point,
  Polygon,
  Polyline,
  Rect,
  util,
  type TMat2D,
} from "fabric";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { useEffect, useRef, useState } from "react";
import {
  captureWindow,
  ensureScreenCaptureAccess,
  exportPng,
  listWindows,
  loadCanvas,
  onShortcutCapture,
  openScreenCaptureSettings,
  pickPngPath,
  saveCanvas,
  type NodeExportDto,
} from "../services/backend";
import { createAutosave } from "./autosave";
import { type MenuAction, type MenuTargets, menuItems, pasteDelta } from "./contextMenu";
import { duplicateProps } from "./duplicate";
import { flattenScale, mergedNodeProps } from "./flatten";
import { expandToGroups, newGroupId, withGroupRows } from "./groups";
import { type ExportTarget, exportTarget } from "./exportImage";
import { createHistory } from "./history";
import { dataUrlToBase64, wrapSvg } from "./exportNode";
import { type Box, type Pt, arrowBetween, arrowHead, lockToAxis } from "./geometry";
import { firstImageFile } from "./imageFile";
import { type Anchor, type HandleSide, hitAnchor, hitHandle, moveAnchor, moveHandle, smoothAnchor, toSvgPath } from "./penPath";
import { type StyledLike, readStyle, toFabricProps } from "./style";
import type { StyleApplies } from "./StyleSection";
import { type BooleanOp, booleanShapes } from "./booleans";
import { assignParents, descendants, renderScale, unionBox } from "./layout";
import { type LayerRow, layerRows, lockProps } from "./layers";
import LayersPanel from "./LayersPanel";
import { pruneLinks } from "./links";
import NodeInspector, { type InspectorNode, type InspectorPatch } from "./NodeInspector";
import WindowPicker, { captureName, type WindowInfo } from "./WindowPicker";
import { type NodeKind, type SfProps, SF_PROPS, newNodeId, nextNodeName, toNodeRecord } from "./nodeRecord";
import { type Matrix, cropBox, ellipsePolygon, rectPolygon, splitByLine, toImagePoints } from "./cut";
import { type CutMode, type DrawingTool, SHAPE_NAMES, type Tool, arrowHeadSize, arrowPath, crossPath, dragBox, polygonPoints, snapLine, toolForKey } from "./tools";
import { DRAWING } from "./drawingDefaults";
import { TEXT_FONT, withTextFont } from "./textFont";
import { type Theme, currentTheme, onThemeChange } from "../theme/appearance";
import { nextZoom } from "./viewport";

// Serialize the ScreenForge props with every object in canvas.json.
FabricObject.customProperties = SF_PROPS;

type SfObject = FabricObject & Partial<SfProps>;

const AUTOSAVE_DELAY_MS = 500;
/** Longest side of the whole-canvas and frame renders sent to the agent. */
const RENDER_MAX_SIDE = 2000;
const CANVAS_RENDER_MARGIN = 40;
/** User exports render at 2x (sharp on Retina), down to this longest side. */
const EXPORT_MAX_SIDE = 8000;
/** How far a duplicate lands from its original, right and down. */
const DUPLICATE_OFFSET = 20;

function isNode(obj: SfObject): obj is FabricObject & SfProps {
  return typeof obj.sfId === "string";
}

/** Hidden nodes stay on the canvas (and in the layers) but are not drawn nor sent to the agent. */
function isShown(obj: FabricObject): boolean {
  return obj.visible !== false;
}

/** Shapes a boolean operation can combine (not text, lines, images or frames). */
function isBooleanShape(obj: FabricObject & SfProps): boolean {
  return obj.sfKind === "vector_drawing" && !(obj instanceof IText) && !(obj instanceof Line) && !obj.sfShape;
}

const BOOLEAN_OPS: { op: BooleanOp; label: string }[] = [
  { op: "union", label: "Union" },
  { op: "subtract", label: "Subtract" },
  { op: "intersect", label: "Intersect" },
  { op: "exclude", label: "Exclude" },
];

/** PNG of a scene region, independent of the current pan and zoom. */
function renderRegion(
  canvas: Canvas,
  box: Box,
  multiplier = renderScale(box, RENDER_MAX_SIDE),
  filter?: (obj: object) => boolean,
  // Content, not theme: the agent sees the same image in light and dark mode.
  background: string = DRAWING.renderBackground,
): string {
  const viewport = canvas.viewportTransform.slice() as TMat2D;
  const shown = canvas.backgroundColor;
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
  canvas.backgroundColor = background;
  try {
    const png = canvas.toDataURL({
      format: "png",
      left: box.left,
      top: box.top,
      width: box.width,
      height: box.height,
      multiplier,
      filter,
    });
    return dataUrlToBase64(png);
  } finally {
    canvas.backgroundColor = shown;
    canvas.setViewportTransform(viewport);
  }
}

type CaptureNode = FabricImage & SfProps;

function tracePolygon(ctx: CanvasRenderingContext2D, poly: Pt[]) {
  ctx.beginPath();
  poly.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
}

/** PNG of the pixels of `source` inside `poly` (image pixels), cropped to `box`. */
function piecePng(source: CanvasImageSource, poly: Pt[], box: Box): string {
  const el = document.createElement("canvas");
  el.width = box.width;
  el.height = box.height;
  const ctx = el.getContext("2d")!;
  ctx.translate(-box.left, -box.top);
  tracePolygon(ctx, poly);
  ctx.clip();
  ctx.drawImage(source, 0, 0);
  return el.toDataURL("image/png");
}

/** PNG of `source` with the pixels inside `poly` made transparent. */
function holedPng(source: CanvasImageSource, width: number, height: number, poly: Pt[]): string {
  const el = document.createElement("canvas");
  el.width = width;
  el.height = height;
  const ctx = el.getContext("2d")!;
  ctx.drawImage(source, 0, 0);
  ctx.globalCompositeOperation = "destination-out";
  tracePolygon(ctx, poly);
  ctx.fill();
  return el.toDataURL("image/png");
}

/** Scene center of an image-pixel box of `img`, which keeps the piece exactly where it was cut. */
function pieceCenter(img: FabricImage, box: Box): Point {
  const local = new Point(box.left + box.width / 2 - img.width / 2, box.top + box.height / 2 - img.height / 2);
  return local.transform(img.calcTransformMatrix());
}

function exportScale(box: Box): number {
  return 2 * renderScale(box, EXPORT_MAX_SIDE / 2);
}

/** PNG the Export button saves for `target`, or null when there is nothing to draw. */
function renderExport(canvas: Canvas, target: ExportTarget, picked: (FabricObject & SfProps)[]): string | null {
  if (target.scope === "node") {
    const [obj] = picked;
    // Captures keep their native resolution, like in the agent export.
    const multiplier = obj.sfKind === "capture" ? 1 / (obj.scaleX || 1) : exportScale(obj.getBoundingRect());
    return dataUrlToBase64(obj.toDataURL({ format: "png", multiplier }));
  }
  const boxes =
    target.scope === "canvas"
      ? canvas.getObjects().filter(isNode).filter(isShown).map((n) => n.getBoundingRect())
      : picked.map((n) => n.getBoundingRect());
  const box = unionBox(boxes, target.scope === "canvas" ? CANVAS_RENDER_MARGIN : 0);
  return box && renderRegion(canvas, box, exportScale(box));
}

function layoutOf(nodes: (FabricObject & SfProps)[]) {
  return assignParents(nodes.map((n) => ({ id: n.sfId, kind: n.sfKind, bounds: n.getBoundingRect() })));
}

function exportNode(
  canvas: Canvas,
  obj: FabricObject & SfProps,
  parents: Record<string, string | undefined>,
  shownIds: Set<string>,
): NodeExportDto {
  const bounds = obj.getBoundingRect();
  const node = toNodeRecord(obj, {
    bounds,
    parent: parents[obj.sfId],
    text: obj instanceof IText ? obj.text : undefined,
    style: styleOf(obj),
    links: pruneLinks(obj.sfLinks ?? [], shownIds),
  });
  if (obj.sfKind === "frame") {
    // A frame's image is the whole screen: the frame with everything placed on it.
    return { node, svg: null, png_base64: renderRegion(canvas, bounds) };
  }
  if (obj.sfKind === "capture") {
    // Captures are bitmaps: export at native resolution, no SVG (it would only wrap the PNG).
    const png = obj.toDataURL({ format: "png", multiplier: 1 / (obj.scaleX || 1) });
    return { node, svg: null, png_base64: dataUrlToBase64(png) };
  }
  const png = obj.toDataURL({ format: "png", multiplier: 1 });
  return { node, svg: wrapSvg(obj.toSVG(), obj.getBoundingRect()), png_base64: dataUrlToBase64(png) };
}

/** Style properties that apply to `obj`; undefined for captures (bitmaps). */
function appliesOf(obj: FabricObject & SfProps): StyleApplies | undefined {
  if (obj.sfKind === "capture") return undefined;
  const openPath = (!!obj.sfAnchors && !obj.sfClosed) || !!obj.sfShape;
  return { fill: !(obj instanceof Line) && !openPath, radius: obj instanceof Rect, text: obj instanceof IText };
}

function styleOf(obj: FabricObject & SfProps) {
  const applies = appliesOf(obj);
  return applies && readStyle(obj as unknown as StyledLike, applies);
}

function toInspectorNode(obj: FabricObject & SfProps): InspectorNode {
  return {
    id: obj.sfId,
    kind: obj.sfKind,
    name: obj.sfName,
    instructions: obj.sfInstructions,
    links: obj.sfLinks ?? [],
    style: styleOf(obj),
    styleApplies: appliesOf(obj),
  };
}

/** Link arrows and frame names are display only: rebuilt from node props, never saved. */
function drawOverlays(canvas: Canvas, previous: FabricObject[], theme: Theme): FabricObject[] {
  previous.forEach((a) => canvas.remove(a));
  const nodes = canvas.getObjects().filter(isNode).filter(isShown);
  const byId = new Map(nodes.map((n) => [n.sfId, n]));
  const overlays: FabricObject[] = [];
  const display = { selectable: false, evented: false, excludeFromExport: true };
  for (const frame of nodes.filter((n) => n.sfKind === "frame")) {
    const bounds = frame.getBoundingRect();
    const label = new FabricText(frame.sfName, {
      ...display,
      left: bounds.left,
      top: bounds.top - 6,
      originX: "left",
      originY: "bottom",
      fontSize: 14,
      fontFamily: TEXT_FONT,
      fill: theme.tx2,
    });
    canvas.add(label);
    overlays.push(label);
  }
  for (const source of nodes) {
    for (const link of source.sfLinks ?? []) {
      const target = byId.get(link.target_node);
      if (!target) continue;
      const line = arrowBetween(source.getBoundingRect(), target.getBoundingRect());
      if (!line) continue;
      const [b1, b2] = arrowHead(line.from, line.to, 12);
      const d = `M ${line.from.x} ${line.from.y} L ${line.to.x} ${line.to.y} M ${b1.x} ${b1.y} L ${line.to.x} ${line.to.y} L ${b2.x} ${b2.y}`;
      // Added last, so arrows stay above frames and the nodes they link.
      const arrow = new Path(d, { ...display, fill: "", stroke: theme.link, strokeWidth: 2 });
      canvas.add(arrow);
      overlays.push(arrow);
    }
  }
  canvas.requestRenderAll();
  return overlays;
}

function tagAsNode(canvas: Canvas, obj: FabricObject, kind: NodeKind, name?: string) {
  const names = canvas.getObjects().filter(isNode).map((o) => o.sfName);
  const props: SfProps = {
    sfId: newNodeId(kind),
    sfKind: kind,
    sfName: name ?? nextNodeName(kind, names),
    sfInstructions: "",
    sfLinks: [],
  };
  Object.assign(obj, props);
}

const TOOLBAR: { id: Tool; label: string; key: string; hint: string }[] = [
  { id: "select", label: "Select", key: "V", hint: "Select and move (Shift keeps the move horizontal or vertical); ⌘D duplicates the selection" },
  { id: "frame", label: "Frame", key: "F", hint: "A named screen: everything placed inside it belongs to it" },
  { id: "rect", label: "Rectangle", key: "R", hint: "Drag to draw; Shift for a square" },
  { id: "ellipse", label: "Ellipse", key: "O", hint: "Drag to draw; Shift for a circle" },
  { id: "line", label: "Line", key: "L", hint: "Drag to draw; Shift snaps to 45°" },
  { id: "arrow", label: "Arrow", key: "A", hint: "Drag from tail to tip; Shift snaps to 45°" },
  { id: "cross", label: "Cross", key: "X", hint: "Drag to draw; Shift keeps it square" },
  { id: "polygon", label: "Polygon", key: "no key", hint: "Drag to draw" },
  { id: "pen", label: "Pen", key: "P", hint: "Click for corners, drag for curves; click the first point to close, Enter to finish; double-click a path to edit it" },
  { id: "text", label: "Text", key: "T", hint: "Click to type" },
  { id: "cut", label: "Cut", key: "C", hint: "Cut a part out of a capture, then move it" },
];

const CUT_MODES: { mode: CutMode; label: string; hint: string }[] = [
  { mode: "lasso", label: "Lasso", hint: "Draw freehand around the part to cut out" },
  { mode: "line", label: "Line", hint: "Draw a line across a capture to split it in two" },
  { mode: "rect", label: "Rectangle", hint: "Drag a box around the part to cut out" },
  { mode: "ellipse", label: "Ellipse", hint: "Drag to cut out an ellipse; Shift for a circle" },
];

const WIREFRAME = { fill: DRAWING.shapeFill, stroke: DRAWING.shapeStroke, strokeWidth: 1, strokeUniform: true };
const TOP_LEFT = { originX: "left", originY: "top" } as const;
/** Size of a shape placed with a click instead of a drag. */
const DEFAULT_SIZE: Record<DrawingTool, { width: number; height: number }> = {
  frame: { width: 800, height: 500 },
  rect: { width: 160, height: 100 },
  ellipse: { width: 120, height: 120 },
  line: { width: 160, height: 0 },
  arrow: { width: 160, height: 0 },
  cross: { width: 40, height: 40 },
  polygon: { width: 120, height: 120 },
  pen: { width: 0, height: 0 },
  text: { width: 0, height: 0 },
};

/** The shape a drag from `start` to `end` draws with `tool` (text is placed on click). */
type ShapeTool = Exclude<DrawingTool, "text" | "pen">;

const PEN_STROKE = { fill: "", stroke: DRAWING.pen, strokeWidth: 2, strokeUniform: true };
const ROUND_ENDS = { strokeLineJoin: "round", strokeLineCap: "round" } as const;

/** An arrow node's path; its head is sized from the stroke width. */
function arrowFrom(start: Pt, end: Pt, style: { fill: string; stroke: string; strokeWidth: number; strokeUniform: boolean; opacity?: number }): Path {
  const path = new Path(arrowPath(start, end, arrowHeadSize(style.strokeWidth)), { ...style, ...ROUND_ENDS });
  return Object.assign(path, { sfShape: "arrow" as const });
}

/**
 * The same arrow redrawn in scene coordinates, so its head follows a new stroke
 * width. Like a path edit, this resets its scale and rotation.
 */
function redrawArrow(canvas: Canvas, old: Path & SfProps): Path & SfProps {
  const matrix = old.calcTransformMatrix();
  const toScene = (cmd: (string | number)[]) =>
    new Point((cmd[1] as number) - old.pathOffset.x, (cmd[2] as number) - old.pathOffset.y).transform(matrix);
  const [start, end] = [toScene(old.path[0]), toScene(old.path[1])];
  const next = arrowFrom(start, end, {
    fill: "",
    stroke: old.stroke as string,
    strokeWidth: old.strokeWidth,
    strokeUniform: true,
    opacity: old.opacity,
  }) as Path & SfProps;
  for (const key of SF_PROPS) (next as unknown as Record<string, unknown>)[key] = old[key];
  canvas.insertAt(canvas.getObjects().indexOf(old), next);
  canvas.remove(old);
  return next;
}
const DISPLAY_ONLY = { selectable: false, evented: false, excludeFromExport: true };

/** A pen path through `anchors`; a closed one gets the wireframe fill. */
function pathFrom(anchors: Anchor[], closed: boolean): Path {
  const path = new Path(toSvgPath(anchors, closed), closed ? { ...WIREFRAME } : { ...PEN_STROKE });
  Object.assign(path, { sfAnchors: anchors, sfClosed: closed });
  return path;
}

/** Points and handle lines shown while drawing or editing a path. */
function anchorMarkers(anchors: Anchor[], zoom: number, withHandles: boolean): FabricObject[] {
  const { sel, panel } = currentTheme();
  const size = 8 / zoom;
  const markers: FabricObject[] = [];
  for (const a of anchors) {
    if (withHandles) {
      for (const h of [a.in, a.out]) {
        if (!h) continue;
        markers.push(new Line([a.x, a.y, h.x, h.y], { ...DISPLAY_ONLY, stroke: sel, strokeWidth: 1 / zoom }));
        markers.push(new Circle({ ...DISPLAY_ONLY, left: h.x, top: h.y, radius: size / 2, fill: sel }));
      }
    }
    markers.push(
      new Rect({ ...DISPLAY_ONLY, left: a.x, top: a.y, width: size, height: size, fill: panel, stroke: sel, strokeWidth: 1 / zoom }),
    );
  }
  return markers;
}

function shapeFor(tool: ShapeTool, start: Point, end: Point, shift: boolean): FabricObject {
  if (tool === "line") {
    const to = snapLine(start, end, shift);
    return new Line([start.x, start.y, to.x, to.y], { stroke: DRAWING.line, strokeWidth: 2, strokeUniform: true });
  }
  if (tool === "arrow") {
    return arrowFrom(start, snapLine(start, end, shift), PEN_STROKE);
  }
  const box = dragBox(start, end, shift);
  const at = { ...TOP_LEFT, left: box.left, top: box.top };
  switch (tool) {
    case "frame":
      return new Rect({ ...at, width: box.width, height: box.height, fill: DRAWING.frameFill, stroke: DRAWING.frameStroke, strokeWidth: 1 });
    case "rect":
      return new Rect({ ...WIREFRAME, ...at, width: box.width, height: box.height });
    case "ellipse":
      return new Ellipse({ ...WIREFRAME, ...at, rx: box.width / 2, ry: box.height / 2 });
    case "polygon":
      return new Polygon(polygonPoints(3, box), { ...WIREFRAME });
    case "cross":
      return Object.assign(new Path(crossPath(box), { ...PEN_STROKE, stroke: DRAWING.cross, strokeLineCap: "round" }), { sfShape: "cross" });
  }
}

/** What the app shell drives on the canvas (the Export button lives in the title bar). */
export interface CanvasControls {
  exportPng: () => Promise<void>;
}

interface CanvasViewProps {
  root: string;
  /** Called after every successful save. */
  onSaved?: (at: Date) => void;
  /** Label of the Export action for the current selection. */
  onExportLabel?: (label: string) => void;
  controls?: { current: CanvasControls | null };
}

export default function CanvasView({ root, onSaved, onExportLabel, controls }: CanvasViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<InspectorNode | null>(null);
  const [others, setOthers] = useState<{ id: string; name: string }[]>([]);
  // Set inside the canvas effect, used by inspector edits and the toolbar.
  const afterEditRef = useRef<() => void>(() => {});
  const applyToolRef = useRef<(t: Tool) => void>(() => {});
  const addImageRef = useRef<(dataUrl: string, name?: string) => Promise<void>>(async () => {});
  const [tool, setTool] = useState<Tool>("select");
  const [cutMode, setCutMode] = useState<CutMode>("lasso");
  const cutModeRef = useRef<CutMode>("lasso");
  cutModeRef.current = cutMode;
  const [layers, setLayers] = useState<LayerRow[]>([]);
  const [booleanCount, setBooleanCount] = useState(0);
  const projectName = root.split("/").filter(Boolean).pop() ?? "canvas";
  const [exportTo, setExportTo] = useState<ExportTarget>(() => exportTarget([], projectName));
  const exportRef = useRef<() => Promise<void>>(async () => {});
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  useEffect(() => onExportLabel?.(exportTo.label), [exportTo.label, onExportLabel]);
  useEffect(() => {
    if (!controls) return;
    controls.current = {
      exportPng: () => exportRef.current().catch((error) => setStatus(`Export failed: ${String(error)}`)),
    };
    return () => {
      controls.current = null;
    };
  }, [controls]);
  const menuOpsRef = useRef<{
    open: (e: MouseEvent) => { targets: MenuTargets; hasClipboard: boolean };
    run: (action: MenuAction) => void;
  } | null>(null);
  const [menu, setMenu] = useState<{ targets: MenuTargets; hasClipboard: boolean }>({
    targets: { count: 0, allLocked: false, grouped: false },
    hasClipboard: false,
  });
  const layerOpsRef = useRef<{
    select: (id: string) => void;
    rename: (id: string, name: string) => void;
    toggleHidden: (id: string) => void;
    toggleLocked: (id: string) => void;
    forward: () => void;
    backward: () => void;
    combine: (op: BooleanOp) => void;
  } | null>(null);
  const toolRef = useRef<Tool>("select");
  toolRef.current = tool;
  const [picker, setPicker] = useState<{ windows: WindowInfo[]; permissionMissing: boolean } | null>(
    null,
  );

  useEffect(() => {
    const container = containerRef.current!;
    const canvas = new Canvas(canvasElRef.current!, {
      width: container.clientWidth,
      height: container.clientHeight,
      backgroundColor: currentTheme().canvas,
      preserveObjectStacking: true,
      // Let right-clicks reach the context menu (Fabric swallows them by default).
      stopContextMenu: false,
    });
    fabricRef.current = canvas;
    let loading = true;

    const autosave = createAutosave(
      async () => {
        const nodes = canvas.getObjects().filter(isNode).filter(isShown);
        const parents = layoutOf(nodes);
        const shownIds = new Set(nodes.map((n) => n.sfId));
        const exports = nodes.map((n) => exportNode(canvas, n, parents, shownIds));
        const extent = unionBox(
          nodes.map((n) => n.getBoundingRect()),
          CANVAS_RENDER_MARGIN,
        );
        const canvasPng = extent && renderRegion(canvas, extent);
        await saveCanvas(root, JSON.stringify(canvas.toObject()), canvasPng, exports);
        onSavedRef.current?.(new Date());
      },
      AUTOSAVE_DELAY_MS,
      (error) => setStatus(`Save failed: ${String(error)}`),
    );
    // Undo history: a snapshot of the canvas after each change, grouped over
    // 300 ms so that a whole drag is one step.
    const history = createHistory<string>(100);
    const snapshot = () => JSON.stringify(canvas.toObject());
    const recorder = createAutosave(async () => history.record(snapshot()), 300);
    let restoring = false;
    /** A user change: recorded for undo and saved. */
    const commit = () => {
      if (restoring) return;
      recorder.schedule();
      autosave.schedule();
    };

    let overlays: FabricObject[] = [];
    const redrawArrows = () => {
      overlays = drawOverlays(canvas, overlays, currentTheme());
    };
    const unlistenTheme = onThemeChange((theme) => {
      canvas.backgroundColor = theme.canvas;
      redrawArrows();
    });
    // Arrow objects come and go on every redraw: only node changes trigger a save.
    const refreshLayers = () => {
      const nodes = canvas.getObjects().filter(isNode);
      const parents = layoutOf(nodes);
      setLayers(
        layerRows(
          withGroupRows(
            nodes.map((n) => ({
              id: n.sfId,
              name: n.sfName,
              kind: n.sfKind,
              parent: parents[n.sfId],
              group: n.sfGroup,
              hidden: !isShown(n),
              locked: !!n.sfLocked,
            })),
          ),
        ),
      );
    };
    const onChange = ({ target }: { target: SfObject }) => {
      if (loading || restoring || !isNode(target)) return;
      redrawArrows();
      refreshLayers();
      commit();
    };
    canvas.on("object:added", onChange);
    canvas.on("object:modified", onChange);
    canvas.on("object:removed", onChange);
    // Shift while dragging keeps the move horizontal or vertical. Registered
    // before the other move handlers so frame content and arrows follow it.
    canvas.on("object:moving", ({ e, target, transform }) => {
      if (!e.shiftKey) return;
      const { left, top } = transform.original;
      const p = lockToAxis({ x: left, y: top }, { x: target.left, y: target.top });
      target.set({ left: p.x, top: p.y });
    });
    canvas.on("object:moving", redrawArrows);

    // Dragging a frame drags everything placed on it, like a screen in Figma.
    let frameDrag: { frame: FabricObject; content: FabricObject[]; left: number; top: number } | null =
      null;
    canvas.on("mouse:down", ({ target }) => {
      const frame = target as SfObject | undefined;
      if (!frame || !isNode(frame) || frame.sfKind !== "frame" || spaceDown) return;
      const nodes = canvas.getObjects().filter(isNode);
      const inside = new Set(descendants(layoutOf(nodes), frame.sfId));
      const content = nodes.filter((n) => inside.has(n.sfId));
      frameDrag = { frame, content, left: frame.left, top: frame.top };
    });
    canvas.on("object:moving", ({ target }) => {
      if (!frameDrag || target !== frameDrag.frame) return;
      const dx = target.left - frameDrag.left;
      const dy = target.top - frameDrag.top;
      for (const obj of frameDrag.content) {
        obj.set({ left: obj.left + dx, top: obj.top + dy });
        obj.setCoords();
      }
      frameDrag.left = target.left;
      frameDrag.top = target.top;
      redrawArrows();
    });
    canvas.on("object:scaling", redrawArrows);

    const syncSelection = () => {
      const active = canvas.getActiveObjects() as SfObject[];
      const node = active.length === 1 && isNode(active[0]) ? active[0] : null;
      setBooleanCount(active.filter(isNode).filter(isBooleanShape).length);
      setExportTo(exportTarget(active.filter(isNode).map((n) => ({ kind: n.sfKind, name: n.sfName })), projectName));
      setSelected(node ? toInspectorNode(node) : null);
      setOthers(
        canvas
          .getObjects()
          .filter(isNode)
          .filter((n) => n !== node)
          .map((n) => ({ id: n.sfId, name: n.sfName })),
      );
    };
    canvas.on("selection:created", syncSelection);
    canvas.on("selection:updated", syncSelection);
    canvas.on("selection:cleared", syncSelection);
    afterEditRef.current = () => {
      syncSelection();
      redrawArrows();
      refreshLayers();
      commit();
    };

    const restore = async (state: string | null) => {
      if (!state) return;
      restoring = true;
      canvas.discardActiveObject();
      await canvas.loadFromJSON(state);
      overlays = [];
      canvas
        .getObjects()
        .filter(isNode)
        .forEach((n) => n.sfLocked && n.set(lockProps(true)));
      redrawArrows();
      refreshLayers();
      syncSelection();
      restoring = false;
      // Save the restored state so that the agent sees it too.
      autosave.schedule();
    };

    // Layers panel actions. Reordering moves past the other nodes only: arrows
    // and frame labels are objects of the stack too.
    const nodeById = (id: string) => canvas.getObjects().filter(isNode).find((n) => n.sfId === id);
    const restack = (direction: 1 | -1, target?: SfObject) => {
      const obj = target ?? (canvas.getActiveObject() as SfObject | undefined);
      if (!obj || !isNode(obj)) return;
      const nodes = canvas.getObjects().filter(isNode);
      const neighbour = nodes[nodes.indexOf(obj) + direction];
      if (!neighbour) return;
      canvas.moveObjectTo(obj, canvas.getObjects().indexOf(neighbour));
      afterEditRef.current();
    };
    exportRef.current = async () => {
      const picked = (canvas.getActiveObjects() as SfObject[]).filter(isNode);
      const target = exportTarget(picked.map((n) => ({ kind: n.sfKind, name: n.sfName })), projectName);
      const png = renderExport(canvas, target, picked);
      if (!png) {
        setStatus("Nothing to export");
        return;
      }
      const path = await pickPngPath(target.fileName);
      if (!path) return;
      await exportPng(path, png);
      setStatus(`Exported ${path.split("/").pop()}`);
    };

    // Copies go right above their originals and become the selection.
    type NodeObject = FabricObject & SfProps;
    const selectedNodes = () => (canvas.getActiveObjects() as SfObject[]).filter(isNode);
    const selectNodes = (nodes: FabricObject[]) => {
      if (nodes.length === 0) return;
      canvas.setActiveObject(nodes.length === 1 ? nodes[0] : new ActiveSelection(nodes, { canvas }));
    };
    /** Copies and pasted nodes start unlocked, with fresh ids. */
    const addAsCopies = (sources: NodeObject[], copies: FabricObject[]) => {
      const props = duplicateProps(sources, newNodeId);
      copies.forEach((copy, i) => {
        Object.assign(copy, props[i], { sfLocked: false });
        copy.set(lockProps(false));
      });
    };
    const duplicate = async (targets?: NodeObject[]) => {
      const picked = targets ?? selectedNodes();
      if (picked.length === 0) return;
      // Out of the selection group, objects carry their absolute placement.
      canvas.discardActiveObject();
      const ordered = canvas.getObjects().filter((o) => picked.includes(o as FabricObject & SfProps)) as (FabricObject & SfProps)[];
      const copies = await Promise.all(ordered.map((o) => o.clone()));
      addAsCopies(ordered, copies);
      copies.forEach((copy, i) => {
        copy.set({ left: copy.left + DUPLICATE_OFFSET, top: copy.top + DUPLICATE_OFFSET });
        copy.setCoords();
        canvas.insertAt(canvas.getObjects().indexOf(ordered[i]) + 1, copy);
      });
      selectNodes(copies);
      canvas.requestRenderAll();
      afterEditRef.current();
    };

    // Copy and paste stay inside ScreenForge: a copy is a snapshot of the nodes,
    // pasted with fresh ids. An image on the system clipboard still pastes as a capture.
    let clipboard: { objects: Record<string, unknown>[]; bounds: Box } | null = null;
    let pasteCount = 0;
    const copy = (targets: NodeObject[]) => {
      if (targets.length === 0) return;
      const selected = selectedNodes();
      const grouped = targets.some((t) => selected.includes(t));
      // Out of the selection group, objects carry their absolute placement.
      if (grouped) canvas.discardActiveObject();
      const ordered = canvas.getObjects().filter((o) => targets.includes(o as NodeObject)) as NodeObject[];
      clipboard = { objects: ordered.map((o) => o.toObject()), bounds: unionBox(ordered.map((o) => o.getBoundingRect()), 0)! };
      pasteCount = 0;
      if (grouped) selectNodes(selected);
      canvas.requestRenderAll();
    };
    const paste = async (at?: Pt) => {
      if (!clipboard) return;
      pasteCount += 1;
      const d = pasteDelta(clipboard.bounds, pasteCount, at);
      const pasted = (await util.enlivenObjects(clipboard.objects)) as FabricObject[];
      addAsCopies(clipboard.objects as unknown as NodeObject[], pasted);
      canvas.discardActiveObject();
      for (const obj of pasted) {
        obj.set({ left: obj.left + d.x, top: obj.top + d.y });
        obj.setCoords();
        canvas.add(obj);
        // Frames sit behind the elements placed on them.
        if ((obj as NodeObject).sfKind === "frame") canvas.sendObjectToBack(obj);
      }
      selectNodes(pasted);
      canvas.requestRenderAll();
      afterEditRef.current();
    };
    const setLocked = (targets: NodeObject[], locked: boolean) => {
      for (const obj of targets) {
        obj.sfLocked = locked;
        obj.set(lockProps(locked));
      }
      if (locked) canvas.discardActiveObject();
      canvas.requestRenderAll();
      afterEditRef.current();
    };

    // Groups are light: members stay nodes of their own, share sfGroup, and are
    // selected and moved together from the canvas. The layers panel can still
    // select one member alone.
    const group = (targets: NodeObject[]) => {
      if (targets.length < 2) return;
      const names = [...new Set(canvas.getObjects().filter(isNode).map((n) => n.sfGroup?.name).filter((n): n is string => !!n))];
      const ref = { id: newGroupId(), name: nextNodeName("vector_drawing", names, "Group") };
      targets.forEach((t) => (t.sfGroup = ref));
      afterEditRef.current();
    };
    const ungroup = (targets: NodeObject[]) => {
      const ids = new Set(targets.map((t) => t.sfGroup?.id).filter(Boolean));
      canvas.getObjects().filter(isNode).forEach((n) => {
        if (n.sfGroup && ids.has(n.sfGroup.id)) delete n.sfGroup;
      });
      afterEditRef.current();
    };
    /** The selection grown to whole groups; only unlocked, shown nodes can join it. */
    const grownSelection = (selected: NodeObject[]) => {
      const pickable = canvas.getObjects().filter(isNode).filter((n) => isShown(n) && !n.sfLocked);
      const ids = expandToGroups(
        selected.map((n) => n.sfId),
        pickable.map((n) => ({ id: n.sfId, group: n.sfGroup?.id })),
      );
      return pickable.filter((n) => ids.includes(n.sfId));
    };
    // A click on a member selects its group before Fabric starts the drag, so
    // the whole group moves.
    canvas.on("mouse:down:before", ({ e }) => {
      if (toolRef.current !== "select" || spaceDown || e.shiftKey || e.metaKey || ("button" in e && e.button !== 0)) return;
      const p = canvas.getScenePoint(e);
      const hit = canvas
        .getObjects()
        .filter(isNode)
        .filter((n) => isShown(n) && !n.sfLocked)
        .reverse()
        .find((n) => n.containsPoint(p));
      if (!hit?.sfGroup || selectedNodes().includes(hit)) return;
      selectNodes(grownSelection([hit]));
      // Fabric found (and cached) the clicked member before this handler ran;
      // drop that private cache so the drag targets the new group selection.
      (canvas as unknown as { _targetInfo?: unknown })._targetInfo = undefined;
    });
    // Box selection and Shift+click also take whole groups (nothing is moving then).
    const growUserSelection = ({ e }: { e?: Event }) => {
      if (!e) return;
      const selected = selectedNodes();
      const grown = grownSelection(selected);
      if (grown.length === selected.length) return;
      selectNodes(grown);
      canvas.requestRenderAll();
    };
    canvas.on("selection:created", growUserSelection);
    canvas.on("selection:updated", growUserSelection);

    // Merge flattens nodes into one capture, like merging layers in an image
    // editor. Links to the sources now point at the merged capture.
    const flatten = async (targets: NodeObject[]) => {
      if (targets.length < 2) return;
      canvas.discardActiveObject();
      const ordered = canvas.getObjects().filter((o) => targets.includes(o as NodeObject)) as NodeObject[];
      const box = unionBox(ordered.map((o) => o.getBoundingRect()), 0)!;
      const scale = flattenScale(box, ordered.filter((o) => o.sfKind === "capture").map((o) => o.scaleX || 1));
      // Only the merged nodes, on a transparent background.
      const png = renderRegion(canvas, box, scale, (o) => ordered.includes(o as NodeObject), "");
      const image = await FabricImage.fromURL(`data:image/png;base64,${png}`);
      const names = canvas.getObjects().filter(isNode).map((o) => o.sfName);
      tagAsNode(canvas, image, "capture", nextNodeName("capture", names, "Merged"));
      Object.assign(image, mergedNodeProps(ordered));
      // Fabric 7 images are positioned by their center.
      image.set({ left: box.left + box.width / 2, top: box.top + box.height / 2, scaleX: 1 / scale, scaleY: 1 / scale });
      image.setCoords();
      canvas.insertAt(canvas.getObjects().indexOf(ordered[ordered.length - 1]) + 1, image);
      ordered.forEach((o) => canvas.remove(o));
      const merged = new Set(ordered.map((o) => o.sfId));
      const mergedId = (image as unknown as NodeObject).sfId;
      for (const n of canvas.getObjects().filter(isNode)) {
        if (n === (image as unknown as NodeObject) || !n.sfLinks?.some((l) => merged.has(l.target_node))) continue;
        const seen = new Set<string>();
        n.sfLinks = n.sfLinks
          .map((l) => (merged.has(l.target_node) ? { ...l, target_node: mergedId } : l))
          .filter((l) => !seen.has(l.target_node) && seen.add(l.target_node));
      }
      canvas.setActiveObject(image);
      canvas.requestRenderAll();
      afterEditRef.current();
    };

    // Right-click acts on the selection when it is clicked, else on the node
    // under the pointer (locked ones included, so they can be unlocked).
    let menuTargets: NodeObject[] = [];
    let menuPoint: Point | null = null;
    const nodeAt = (p: Point) =>
      canvas.getObjects().filter(isNode).filter(isShown).reverse().find((o) => o.containsPoint(p));
    menuOpsRef.current = {
      open: (e) => {
        menuPoint = canvas.getScenePoint(e);
        const hit = nodeAt(menuPoint);
        const selected = selectedNodes();
        if (hit && selected.includes(hit)) {
          menuTargets = selected;
        } else {
          menuTargets = hit ? [hit] : [];
          canvas.discardActiveObject();
          if (hit && !hit.sfLocked) canvas.setActiveObject(hit);
          canvas.requestRenderAll();
          syncSelection();
        }
        return {
          targets: {
            count: menuTargets.length,
            allLocked: menuTargets.length > 0 && menuTargets.every((t) => t.sfLocked),
            grouped: menuTargets.some((t) => t.sfGroup),
          },
          hasClipboard: clipboard !== null,
        };
      },
      run: (action) => {
        const targets = menuTargets;
        const fail = (error: unknown) => setStatus(`${action} failed: ${String(error)}`);
        if (action === "copy") copy(targets);
        if (action === "paste") paste(menuPoint ?? undefined).catch(fail);
        if (action === "duplicate") duplicate(targets).catch(fail);
        if (action === "group") group(targets);
        if (action === "ungroup") ungroup(targets);
        if (action === "merge") flatten(targets).catch(fail);
        if (action === "lock") setLocked(targets, !targets.every((t) => t.sfLocked));
        if (action === "forward" || action === "backward") restack(action === "forward" ? 1 : -1, targets[0]);
      },
    };
    // A row is a node or a group; a group row acts on all its members.
    const rowNodes = (id: string) => {
      const obj = nodeById(id);
      return obj ? [obj] : canvas.getObjects().filter(isNode).filter((n) => n.sfGroup?.id === id);
    };
    layerOpsRef.current = {
      select: (id) => {
        const picked = rowNodes(id).filter((n) => isShown(n) && !n.sfLocked);
        if (picked.length === 0) return;
        canvas.discardActiveObject();
        canvas.setActiveObject(picked.length === 1 ? picked[0] : new ActiveSelection(picked, { canvas }));
        canvas.requestRenderAll();
        syncSelection();
      },
      rename: (id, name) => {
        const obj = nodeById(id);
        if (obj) obj.sfName = name;
        else rowNodes(id).forEach((n) => (n.sfGroup = { id, name }));
        afterEditRef.current();
      },
      toggleHidden: (id) => {
        const nodes = rowNodes(id);
        const visible = nodes.every((n) => !isShown(n));
        nodes.forEach((n) => (n.visible = visible));
        if (!visible) canvas.discardActiveObject();
        canvas.requestRenderAll();
        afterEditRef.current();
      },
      toggleLocked: (id) => {
        const nodes = rowNodes(id);
        const locked = !nodes.every((n) => n.sfLocked);
        nodes.forEach((n) => {
          n.sfLocked = locked;
          n.set(lockProps(locked));
        });
        if (locked) canvas.discardActiveObject();
        canvas.requestRenderAll();
        afterEditRef.current();
      },
      forward: () => restack(1),
      backward: () => restack(-1),
      combine: (op) => {
        const picked = (canvas.getActiveObjects() as SfObject[]).filter(isNode).filter(isBooleanShape);
        if (picked.length < 2) return;
        // Out of the selection group, objects export their absolute placement.
        canvas.discardActiveObject();
        const ordered = canvas.getObjects().filter((o) => picked.includes(o as FabricObject & SfProps)) as (FabricObject & SfProps)[];
        const result = booleanShapes(
          op,
          ordered.map((o) => `<svg xmlns="http://www.w3.org/2000/svg">${o.toSVG()}</svg>`),
        );
        if (!result) {
          setStatus(`${op}: nothing is left`);
          return;
        }
        const bottom = ordered[0];
        const path = result.anchors ? pathFrom(result.anchors, true) : new Path(result.pathData);
        path.set({ fill: bottom.fill, stroke: bottom.stroke, strokeWidth: bottom.strokeWidth, opacity: bottom.opacity, strokeUniform: true });
        const names = canvas.getObjects().filter(isNode).map((o) => o.sfName);
        const label = BOOLEAN_OPS.find((b) => b.op === op)!.label;
        tagAsNode(canvas, path, "vector_drawing", nextNodeName("vector_drawing", names, label));
        canvas.insertAt(canvas.getObjects().indexOf(ordered[ordered.length - 1]) + 1, path);
        // The originals stay, hidden, so a wrong operation can be undone from the layers.
        ordered.forEach((o) => (o.visible = false));
        path.setCoords();
        canvas.setActiveObject(path);
        canvas.requestRenderAll();
        afterEditRef.current();
      },
    };

    loadCanvas(root)
      .then(async (json) => {
        if (json) await canvas.loadFromJSON(withTextFont(json));
        canvas
          .getObjects()
          .filter(isNode)
          .forEach((n) => n.sfLocked && n.set(lockProps(true)));
        redrawArrows();
        refreshLayers();
        history.record(snapshot());
      })
      .catch((error) => {
        // Saving now would mirror an empty canvas and delete every node on disk.
        autosave.block();
        setStatus(`Load failed, saving is disabled to protect your files: ${String(error)}`);
      })
      .finally(() => {
        loading = false;
      });

    // Trackpad: two-finger scroll pans, pinch (ctrlKey) or Cmd+wheel zooms.
    canvas.on("mouse:wheel", ({ e }) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        canvas.zoomToPoint(new Point(e.offsetX, e.offsetY), nextZoom(canvas.getZoom(), e.deltaY * 10));
      } else {
        canvas.relativePan(new Point(-e.deltaX, -e.deltaY));
      }
    });

    // Space + drag pans.
    let spaceDown = false;
    let lastPan: Point | null = null;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") {
        spaceDown = true;
        canvas.selection = false;
        canvas.defaultCursor = "grab";
      }
      if (e.target instanceof HTMLSelectElement) return;
      if (onPenKey(e)) return;
      if (e.metaKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        restore(e.shiftKey ? history.redo() : history.undo());
        return;
      }
      if (e.metaKey && (e.key === "]" || e.key === "[")) {
        e.preventDefault();
        restack(e.key === "]" ? 1 : -1);
        return;
      }
      if (e.metaKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        if (e.shiftKey) ungroup(selectedNodes());
        else group(selectedNodes());
        return;
      }
      if (e.metaKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        flatten(selectedNodes()).catch((error) => setStatus(`Merge failed: ${String(error)}`));
        return;
      }
      if (e.metaKey && e.key.toLowerCase() === "c") {
        copy(selectedNodes());
        return;
      }
      if (e.metaKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        if (!edit) duplicate().catch((error) => setStatus(`Duplicate failed: ${String(error)}`));
        return;
      }
      if (edit) {
        if (e.key === "Escape" || e.key === "Enter") exitEdit();
        e.preventDefault();
        return;
      }
      const picked = toolForKey(e);
      if (picked) setTool(picked);
      if (e.key === "Escape") setTool("select");
      if (e.key === "Backspace" || e.key === "Delete") {
        canvas.getActiveObjects().forEach((o) => canvas.remove(o));
        canvas.discardActiveObject();
        // Links pointing at removed nodes go with them.
        const remaining = canvas.getObjects().filter(isNode);
        const ids = new Set(remaining.map((n) => n.sfId));
        remaining.forEach((n) => (n.sfLinks = pruneLinks(n.sfLinks ?? [], ids)));
        redrawArrows();
        commit();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceDown = false;
        applyTool(toolRef.current);
      }
    };
    canvas.on("mouse:down", ({ e }) => {
      if (spaceDown && "clientX" in e) lastPan = new Point(e.clientX, e.clientY);
    });
    canvas.on("mouse:move", ({ e }) => {
      if (!lastPan || !("clientX" in e)) return;
      canvas.relativePan(new Point(e.clientX - lastPan.x, e.clientY - lastPan.y));
      lastPan = new Point(e.clientX, e.clientY);
    });
    canvas.on("mouse:up", () => {
      lastPan = null;
      frameDrag = null;
    });

    // Drawing: the active tool draws a shape by dragging; the preview is not a
    // node (so no save) until the mouse is released.
    const applyTool = (t: Tool) => {
      if (t !== "pen" && pen) finishPen(false);
      canvas.selection = t === "select";
      canvas.skipTargetFind = t !== "select";
      canvas.defaultCursor = t === "select" ? "default" : t === "text" ? "text" : "crosshair";
    };
    applyToolRef.current = applyTool;
    let drawing: { tool: ShapeTool; start: Point; preview: FabricObject } | null = null;
    const finishShape = (obj: FabricObject, t: DrawingTool) => {
      const names = canvas.getObjects().filter(isNode).map((o) => o.sfName);
      const kind = t === "frame" ? "frame" : "vector_drawing";
      tagAsNode(canvas, obj, kind, nextNodeName(kind, names, SHAPE_NAMES[t]));
      obj.setCoords();
      // Frames sit behind the elements placed on them.
      if (t === "frame") canvas.sendObjectToBack(obj);
      canvas.setActiveObject(obj);
      setTool("select");
      // The shape was added before it became a node, so onChange skipped it.
      redrawArrows();
      refreshLayers();
      commit();
    };
    canvas.on("mouse:down", ({ e }) => {
      const t = toolRef.current;
      if (t === "select" || t === "pen" || t === "cut" || spaceDown) return;
      const start = canvas.getScenePoint(e);
      if (t === "text") {
        const text = new IText("Text", { ...TOP_LEFT, left: start.x, top: start.y, fontSize: 20, fontFamily: TEXT_FONT, fill: DRAWING.text });
        canvas.add(text);
        finishShape(text, "text");
        text.enterEditing();
        text.selectAll();
        return;
      }
      const preview = shapeFor(t, start, start, false);
      canvas.add(preview);
      drawing = { tool: t, start, preview };
    });
    canvas.on("mouse:move", ({ e }) => {
      if (!drawing) return;
      canvas.remove(drawing.preview);
      drawing.preview = shapeFor(drawing.tool, drawing.start, canvas.getScenePoint(e), e.shiftKey);
      canvas.add(drawing.preview);
    });
    canvas.on("mouse:up", ({ e }) => {
      if (!drawing) return;
      const { tool: t, start } = drawing;
      canvas.remove(drawing.preview);
      let end = canvas.getScenePoint(e);
      // A click without a drag places a shape of the default size.
      if (Math.abs(end.x - start.x) < 4 && Math.abs(end.y - start.y) < 4) {
        const size = DEFAULT_SIZE[t];
        end = new Point(start.x + size.width, start.y + size.height);
      }
      drawing = null;
      const shape = shapeFor(t, start, end, e.shiftKey);
      canvas.add(shape);
      finishShape(shape, t);
    });
    // Cut: the gesture cuts the topmost capture it reaches. Lasso and box cut
    // a piece out (the capture keeps a transparent hole); a line splits the
    // capture in two. The capture keeps its id, name, notes and links.
    let cut: { mode: CutMode; points: Point[]; shift: boolean; preview: FabricObject | null } | null = null;
    /** Scene outline of the part to cut; a line cut keeps its two ends. */
    const cutOutline = (c: { mode: CutMode; points: Pt[]; shift: boolean }): Pt[] => {
      const first = c.points[0];
      const last = c.points[c.points.length - 1];
      if (c.mode === "rect") return rectPolygon(first, last);
      if (c.mode === "ellipse") return ellipsePolygon(dragBox(first, last, c.shift));
      return c.mode === "line" ? [first, last] : c.points;
    };
    const drawCutPreview = () => {
      if (!cut) return;
      if (cut.preview) canvas.remove(cut.preview);
      const [first] = cut.points;
      const last = cut.points[cut.points.length - 1];
      const style = { ...DISPLAY_ONLY, fill: "", stroke: currentTheme().sel, strokeWidth: 1.5 / canvas.getZoom(), strokeDashArray: [6 / canvas.getZoom(), 4 / canvas.getZoom()] };
      const outline = cutOutline(cut);
      cut.preview =
        cut.mode === "line"
          ? new Line([first.x, first.y, last.x, last.y], style)
          : new Polyline(cut.mode === "lasso" ? outline : [...outline, outline[0]], style);
      canvas.add(cut.preview);
      canvas.requestRenderAll();
    };
    const cutCapture = async (mode: CutMode, points: Pt[]) => {
      const captures = canvas
        .getObjects()
        .filter(isNode)
        .filter((n): n is CaptureNode => n.sfKind === "capture" && isShown(n) && !n.sfLocked && n instanceof FabricImage)
        .reverse();
      for (const img of captures) {
        const inverse = util.invertTransform(img.calcTransformMatrix()) as unknown as Matrix;
        const local = toImagePoints(points, inverse, img.width, img.height);
        const source = img.getElement() as CanvasImageSource;
        const names = canvas.getObjects().filter(isNode).map((o) => o.sfName);
        const pieceName = nextNodeName("capture", names, `${img.sfName} cut`);
        const place = async (dataUrl: string, box: Box, target?: CaptureNode) => {
          const center = pieceCenter(img, box);
          const piece = target ?? (await FabricImage.fromURL(dataUrl));
          if (target) await target.setSrc(dataUrl);
          else tagAsNode(canvas, piece, "capture", pieceName);
          piece.set({ left: center.x, top: center.y, scaleX: img.scaleX, scaleY: img.scaleY, angle: img.angle, flipX: img.flipX, flipY: img.flipY });
          piece.setCoords();
          return piece;
        };
        if (mode === "line") {
          const halves = splitByLine(img.width, img.height, local[0], local[local.length - 1]);
          if (!halves) continue;
          const boxes = halves.map((h) => cropBox(h, img.width, img.height)!);
          const urls = halves.map((h, i) => piecePng(source, h, boxes[i]));
          // The new half is placed before the original is reshaped: both use its transform.
          const other = await place(urls[1], boxes[1]);
          await place(urls[0], boxes[0], img);
          canvas.insertAt(canvas.getObjects().indexOf(img) + 1, other);
          canvas.setActiveObject(other);
        } else {
          const poly = local;
          const box = poly.length >= 3 ? cropBox(poly, img.width, img.height) : null;
          if (!box) continue;
          const piece = await place(piecePng(source, poly, box), box);
          await img.setSrc(holedPng(source, img.width, img.height, poly));
          canvas.insertAt(canvas.getObjects().indexOf(img) + 1, piece);
          canvas.setActiveObject(piece);
        }
        canvas.requestRenderAll();
        afterEditRef.current();
        return;
      }
      setStatus("Nothing to cut: draw over a capture");
    };
    canvas.on("mouse:down", ({ e }) => {
      if (toolRef.current !== "cut" || spaceDown) return;
      cut = { mode: cutModeRef.current, points: [canvas.getScenePoint(e)], shift: e.shiftKey, preview: null };
    });
    canvas.on("mouse:move", ({ e }) => {
      if (!cut) return;
      const p = canvas.getScenePoint(e);
      if (cut.mode === "lasso") cut.points.push(p);
      else cut.points = [cut.points[0], p];
      cut.shift = e.shiftKey;
      drawCutPreview();
    });
    canvas.on("mouse:up", () => {
      if (!cut) return;
      const { mode, points, preview } = cut;
      const outline = cutOutline(cut);
      cut = null;
      if (preview) canvas.remove(preview);
      setTool("select");
      if (points.length < 2) return;
      cutCapture(mode, outline).catch((error) => setStatus(`Cut failed: ${String(error)}`));
    });

    // Pen: click for a corner, drag for a smooth point; click the first point to
    // close, Enter or Escape to finish open, Backspace to drop the last point.
    let pen: { anchors: Anchor[]; pressed: Point | null; cursor: Point | null; preview: FabricObject[] } | null = null;
    const drawPenPreview = () => {
      if (!pen) return;
      pen.preview.forEach((o) => canvas.remove(o));
      const pending =
        pen.pressed && pen.cursor ? smoothAnchor(pen.pressed, pen.cursor) : pen.cursor ? { x: pen.cursor.x, y: pen.cursor.y } : null;
      const shown = pending ? [...pen.anchors, pending] : pen.anchors;
      pen.preview = [
        new Path(toSvgPath(shown, false) || "M 0 0", { ...PEN_STROKE, ...DISPLAY_ONLY }),
        ...anchorMarkers(pen.anchors, canvas.getZoom(), false),
      ];
      pen.preview.forEach((o) => canvas.add(o));
      canvas.requestRenderAll();
    };
    const finishPen = (closed: boolean) => {
      if (!pen) return;
      const { anchors, preview } = pen;
      pen = null;
      preview.forEach((o) => canvas.remove(o));
      if (anchors.length >= 2) {
        const path = pathFrom(anchors, closed);
        canvas.add(path);
        finishShape(path, "pen");
      } else {
        setTool("select");
      }
    };
    canvas.on("mouse:down", ({ e }) => {
      if (toolRef.current !== "pen" || spaceDown) return;
      const p = canvas.getScenePoint(e);
      if (pen && pen.anchors.length >= 2 && hitAnchor([pen.anchors[0]], p, 8 / canvas.getZoom()) === 0) {
        finishPen(true);
        return;
      }
      pen ??= { anchors: [], pressed: null, cursor: null, preview: [] };
      pen.pressed = p;
    });
    canvas.on("mouse:move", ({ e }) => {
      if (!pen) return;
      pen.cursor = canvas.getScenePoint(e);
      drawPenPreview();
    });
    canvas.on("mouse:up", ({ e }) => {
      if (!pen?.pressed) return;
      const p = canvas.getScenePoint(e);
      const dragged = Math.hypot(p.x - pen.pressed.x, p.y - pen.pressed.y) > 3;
      pen.anchors.push(dragged ? smoothAnchor(pen.pressed, p) : { x: pen.pressed.x, y: pen.pressed.y });
      pen.pressed = null;
      pen.cursor = null;
      drawPenPreview();
    });
    const onPenKey = (e: KeyboardEvent): boolean => {
      if (!pen) return false;
      if (e.key === "Enter" || e.key === "Escape") finishPen(false);
      else if (e.key === "Backspace" || e.key === "Delete") {
        pen.anchors.pop();
        drawPenPreview();
      }
      e.preventDefault();
      return true;
    };

    // Path editing: double-click a pen path to drag its points and handles (Alt
    // moves one handle alone); Escape or a click elsewhere ends the edit.
    type PathNode = Path & SfProps;
    let edit: {
      obj: PathNode;
      anchors: Anchor[];
      overlays: FabricObject[];
      drag: { index: number; which: HandleSide | "anchor" } | null;
    } | null = null;
    const drawEditOverlays = () => {
      if (!edit) return;
      edit.overlays.forEach((o) => canvas.remove(o));
      edit.overlays = anchorMarkers(edit.anchors, canvas.getZoom(), true);
      edit.overlays.forEach((o) => canvas.add(o));
      canvas.requestRenderAll();
    };
    const rebuildEditedPath = () => {
      if (!edit) return;
      const old = edit.obj;
      const next = pathFrom(edit.anchors, !!old.sfClosed) as PathNode;
      const { fill, stroke, strokeWidth, opacity, strokeUniform } = old;
      next.set({ fill, stroke, strokeWidth, opacity, strokeUniform });
      Object.assign(next, { sfId: old.sfId, sfKind: old.sfKind, sfName: old.sfName, sfInstructions: old.sfInstructions, sfLinks: old.sfLinks });
      canvas.insertAt(canvas.getObjects().indexOf(old), next);
      canvas.remove(old);
      edit.obj = next;
    };
    const enterEdit = (obj: PathNode) => {
      // Stored points are in path coordinates: project them with the object's
      // current transform, since the path may have been moved or scaled.
      const matrix = obj.calcTransformMatrix();
      const toScene = (p: { x: number; y: number }) =>
        new Point(p.x - obj.pathOffset.x, p.y - obj.pathOffset.y).transform(matrix);
      const anchors = (obj.sfAnchors ?? []).map((a) => ({
        ...toScene(a),
        ...(a.in && { in: toScene(a.in) }),
        ...(a.out && { out: toScene(a.out) }),
      }));
      canvas.discardActiveObject();
      edit = { obj, anchors, overlays: [], drag: null };
      canvas.selection = false;
      canvas.skipTargetFind = true;
      rebuildEditedPath();
      drawEditOverlays();
    };
    const exitEdit = () => {
      if (!edit) return;
      const { obj, overlays } = edit;
      edit = null;
      overlays.forEach((o) => canvas.remove(o));
      applyTool(toolRef.current);
      canvas.setActiveObject(obj);
      canvas.requestRenderAll();
      commit();
    };
    canvas.on("mouse:dblclick", ({ target }) => {
      const obj = target as SfObject | undefined;
      if (obj && isNode(obj) && obj.sfAnchors) enterEdit(obj as PathNode);
    });
    canvas.on("mouse:down", ({ e }) => {
      if (!edit || spaceDown) return;
      const p = canvas.getScenePoint(e);
      const tolerance = 8 / canvas.getZoom();
      const handle = hitHandle(edit.anchors, p, tolerance);
      const anchor = hitAnchor(edit.anchors, p, tolerance);
      if (handle) edit.drag = handle;
      else if (anchor >= 0) edit.drag = { index: anchor, which: "anchor" };
      else exitEdit();
    });
    canvas.on("mouse:move", ({ e }) => {
      if (!edit?.drag) return;
      const p = canvas.getScenePoint(e);
      const { index, which } = edit.drag;
      edit.anchors =
        which === "anchor" ? moveAnchor(edit.anchors, index, p) : moveHandle(edit.anchors, index, which, p, e.altKey);
      rebuildEditedPath();
      drawEditOverlays();
    });
    canvas.on("mouse:up", () => {
      if (edit) edit.drag = null;
    });

    // Text edits are node changes; an emptied text is removed.
    canvas.on("text:changed", () => commit());
    canvas.on("text:editing:exited", ({ target }) => {
      if (target.text.trim() === "") canvas.remove(target);
      commit();
    });

    // A captured, pasted or dropped image becomes a capture node.
    const addImage = async (dataUrl: string, at: Point, name?: string) => {
      const image = await FabricImage.fromURL(dataUrl);
      tagAsNode(canvas, image, "capture", name);
      // Fabric 7 objects are positioned by their center (originX/Y default to "center").
      image.set({ left: at.x, top: at.y });
      canvas.add(image);
      canvas.setActiveObject(image);
    };
    addImageRef.current = (dataUrl, name) => addImage(dataUrl, canvas.getVpCenter(), name);
    const addCapture = async (file: File, at: Point) => {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      await addImage(dataUrl, at);
    };
    const onPaste = (e: ClipboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const file = firstImageFile(e.clipboardData?.files);
      if (!file) {
        if (clipboard) {
          e.preventDefault();
          paste().catch((error) => setStatus(`Paste failed: ${String(error)}`));
        }
        return;
      }
      e.preventDefault();
      addCapture(file, canvas.getVpCenter()).catch((error) => setStatus(`Paste failed: ${String(error)}`));
    };
    // Requires dragDropEnabled: false on the Tauri window, otherwise Tauri swallows drops.
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => {
      const file = firstImageFile(e.dataTransfer?.files);
      if (!file) return;
      e.preventDefault();
      addCapture(file, canvas.getScenePoint(e)).catch((error) => setStatus(`Drop failed: ${String(error)}`));
    };

    const resize = new ResizeObserver(() => {
      canvas.setDimensions({ width: container.clientWidth, height: container.clientHeight });
    });
    resize.observe(container);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("paste", onPaste);
    container.addEventListener("dragover", onDragOver);
    container.addEventListener("drop", onDrop);
    // Cmd+Shift+X captures the window in front without bringing ScreenForge forward.
    const unlistenShortcut = onShortcutCapture(
      ({ window, png_base64 }) =>
        addImage(`data:image/png;base64,${png_base64}`, canvas.getVpCenter(), captureName(window))
          .then(() => setStatus(`Captured ${captureName(window)}`))
          .catch((error) => setStatus(`Capture failed: ${String(error)}`)),
      (message) => setStatus(`Capture failed: ${message}`),
    );

    return () => {
      unlistenShortcut.then((unlisten) => unlisten());
      resize.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("paste", onPaste);
      container.removeEventListener("dragover", onDragOver);
      container.removeEventListener("drop", onDrop);
      fabricRef.current = null;
      unlistenTheme();
      canvas.dispose();
    };
  }, [root]);

  useEffect(() => {
    applyToolRef.current(tool);
    const canvas = fabricRef.current;
    if (canvas && tool !== "select") {
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    }
  }, [tool]);

  async function openPicker() {
    try {
      const granted = await ensureScreenCaptureAccess();
      setPicker({ windows: granted ? await listWindows() : [], permissionMissing: !granted });
    } catch (error) {
      setStatus(`Window list failed: ${String(error)}`);
    }
  }

  async function pickWindow(w: WindowInfo) {
    setPicker(null);
    try {
      const png = await captureWindow(w.id);
      await addImageRef.current(`data:image/png;base64,${png}`, captureName(w));
    } catch (error) {
      setStatus(`Capture failed: ${String(error)}`);
    }
  }

  function onInspectorChange(patch: InspectorPatch) {
    const canvas = fabricRef.current;
    const obj = canvas?.getObjects().filter(isNode).find((n) => n.sfId === selected?.id);
    if (!obj) return;
    if (patch.name !== undefined) obj.sfName = patch.name;
    if (patch.instructions !== undefined) obj.sfInstructions = patch.instructions;
    if (patch.links !== undefined) obj.sfLinks = patch.links;
    const applies = appliesOf(obj);
    if (patch.style !== undefined && applies) {
      const { fill, ...props } = toFabricProps(patch.style, applies);
      const widthChanged = props.strokeWidth !== undefined && props.strokeWidth !== obj.strokeWidth;
      obj.set({ ...props, fill: typeof fill === "string" ? fill : new Gradient(fill) });
      obj.setCoords();
      if (obj.sfShape === "arrow" && widthChanged) canvas!.setActiveObject(redrawArrow(canvas!, obj as Path & SfProps));
      canvas!.requestRenderAll();
    }
    afterEditRef.current();
  }

  return (
    <div className="flex min-h-0 flex-1">
      <LayersPanel
        rows={layers}
        selectedId={selected?.id ?? null}
        onSelect={(id) => layerOpsRef.current?.select(id)}
        onRename={(id, name) => layerOpsRef.current?.rename(id, name)}
        onToggleHidden={(id) => layerOpsRef.current?.toggleHidden(id)}
        onToggleLocked={(id) => layerOpsRef.current?.toggleLocked(id)}
        onForward={() => layerOpsRef.current?.forward()}
        onBackward={() => layerOpsRef.current?.backward()}
      />
      {/* min-w-0: a flex item never shrinks below its content (the fixed-size <canvas>)
          otherwise, which pushes the inspector off screen. */}
      <div className="relative min-w-0 flex-1 overflow-hidden">
        {/* Wraps instead of sliding under the inspector when the canvas is narrow. */}
        <div className="pointer-events-none absolute left-3 right-3 top-3 z-10 flex flex-wrap items-start gap-2 [&>*]:pointer-events-auto">
          <div className="flex overflow-hidden rounded-md border border-line2 bg-panel shadow-sm">
            {TOOLBAR.map(({ id, label, key, hint }) => (
              <button
                key={id}
                onClick={() => setTool(id)}
                aria-pressed={tool === id}
                title={`${hint} (${key})`}
                className={`whitespace-nowrap px-3 py-1.5 text-sm ${tool === id ? "bg-acc text-acc-tx" : "hover:bg-hover"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {tool === "cut" && (
            <div className="flex overflow-hidden rounded-md border border-line2 bg-panel shadow-sm">
              {CUT_MODES.map(({ mode, label, hint }) => (
                <button
                  key={mode}
                  onClick={() => setCutMode(mode)}
                  aria-pressed={cutMode === mode}
                  title={hint}
                  className={`px-3 py-1.5 text-sm ${cutMode === mode ? "bg-acc text-acc-tx" : "hover:bg-hover"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={openPicker}
            title="Pick a window of this desktop. ⌘⇧X from any app captures the window in front."
            className="whitespace-nowrap rounded-md border border-line2 bg-panel px-3 py-1.5 text-sm shadow-sm hover:bg-hover"
          >
            Capture window
          </button>
          {booleanCount >= 2 && (
            <div className="flex overflow-hidden rounded-md border border-line2 bg-panel shadow-sm">
              {BOOLEAN_OPS.map(({ op, label }) => (
                <button
                  key={op}
                  onClick={() => layerOpsRef.current?.combine(op)}
                  title={op === "subtract" ? "Remove the upper shapes from the bottom one" : `${label} of the selected shapes`}
                  className="px-3 py-1.5 text-sm hover:bg-hover"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        {picker && (
          <WindowPicker
            windows={picker.windows}
            permissionMissing={picker.permissionMissing}
            onOpenSettings={() => openScreenCaptureSettings()}
            onPick={pickWindow}
            onCancel={() => setPicker(null)}
          />
        )}
        <div className="absolute bottom-2 right-3 z-10 text-xs text-tx3">{status}</div>
        <ContextMenu.Root>
          <ContextMenu.Trigger asChild onContextMenu={(e) => menuOpsRef.current && setMenu(menuOpsRef.current.open(e.nativeEvent))}>
            <div ref={containerRef} data-testid="canvas-root" className="h-full w-full">
              <canvas ref={canvasElRef} />
            </div>
          </ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Content className="z-40 min-w-48 rounded-md border border-line bg-panel p-1 text-sm shadow-lg">
              {menuItems(menu.targets, menu.hasClipboard).map((item, i) =>
                item === "separator" ? (
                  <ContextMenu.Separator key={i} className="my-1 h-px bg-line" />
                ) : (
                  <ContextMenu.Item
                    key={item.id}
                    disabled={!item.enabled}
                    onSelect={() => menuOpsRef.current?.run(item.id)}
                    className="flex cursor-default items-center justify-between gap-6 rounded px-2 py-1 outline-none data-[disabled]:text-tx3 data-[highlighted]:bg-hover"
                  >
                    {item.label}
                    {item.shortcut && <span className="text-xs text-tx3">{item.shortcut}</span>}
                  </ContextMenu.Item>
                ),
              )}
            </ContextMenu.Content>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      </div>
      {selected && <NodeInspector node={selected} others={others} onChange={onInspectorChange} />}
    </div>
  );
}
