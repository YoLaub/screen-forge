import {
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
  Rect,
  type TMat2D,
} from "fabric";
import { useEffect, useRef, useState } from "react";
import {
  captureWindow,
  ensureScreenCaptureAccess,
  listWindows,
  loadCanvas,
  onShortcutCapture,
  openScreenCaptureSettings,
  saveCanvas,
  type NodeExportDto,
} from "../services/backend";
import { createAutosave } from "./autosave";
import { createHistory } from "./history";
import { dataUrlToBase64, wrapSvg } from "./exportNode";
import { type Box, arrowBetween, arrowHead } from "./geometry";
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
import { type DrawingTool, SHAPE_NAMES, type Tool, dragBox, polygonPoints, snapLine, toolForKey } from "./tools";
import { nextZoom } from "./viewport";

// Serialize the ScreenForge props with every object in canvas.json.
FabricObject.customProperties = SF_PROPS;

type SfObject = FabricObject & Partial<SfProps>;

const AUTOSAVE_DELAY_MS = 500;
/** Longest side of the whole-canvas and frame renders sent to the agent. */
const RENDER_MAX_SIDE = 2000;
const CANVAS_RENDER_MARGIN = 40;

function isNode(obj: SfObject): obj is FabricObject & SfProps {
  return typeof obj.sfId === "string";
}

/** Hidden nodes stay on the canvas (and in the layers) but are not drawn nor sent to the agent. */
function isShown(obj: FabricObject): boolean {
  return obj.visible !== false;
}

/** Shapes a boolean operation can combine (not text, lines, images or frames). */
function isBooleanShape(obj: FabricObject & SfProps): boolean {
  return obj.sfKind === "vector_drawing" && !(obj instanceof IText) && !(obj instanceof Line);
}

const BOOLEAN_OPS: { op: BooleanOp; label: string }[] = [
  { op: "union", label: "Union" },
  { op: "subtract", label: "Subtract" },
  { op: "intersect", label: "Intersect" },
  { op: "exclude", label: "Exclude" },
];

/** PNG of a scene region, independent of the current pan and zoom. */
function renderRegion(canvas: Canvas, box: Box): string {
  const viewport = canvas.viewportTransform.slice() as TMat2D;
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
  try {
    const png = canvas.toDataURL({
      format: "png",
      left: box.left,
      top: box.top,
      width: box.width,
      height: box.height,
      multiplier: renderScale(box, RENDER_MAX_SIDE),
    });
    return dataUrlToBase64(png);
  } finally {
    canvas.setViewportTransform(viewport);
  }
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
  const openPath = !!obj.sfAnchors && !obj.sfClosed;
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
function drawOverlays(canvas: Canvas, previous: FabricObject[]): FabricObject[] {
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
      fontFamily: "system-ui, sans-serif",
      fill: "#737373",
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
      const arrow = new Path(d, { ...display, fill: "", stroke: "#64748b", strokeWidth: 2 });
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
  { id: "select", label: "Select", key: "V", hint: "Select and move" },
  { id: "frame", label: "Frame", key: "F", hint: "A named screen: everything placed inside it belongs to it" },
  { id: "rect", label: "Rectangle", key: "R", hint: "Drag to draw; Shift for a square" },
  { id: "ellipse", label: "Ellipse", key: "O", hint: "Drag to draw; Shift for a circle" },
  { id: "line", label: "Line", key: "L", hint: "Drag to draw; Shift snaps to 45°" },
  { id: "polygon", label: "Polygon", key: "no key", hint: "Drag to draw" },
  { id: "pen", label: "Pen", key: "P", hint: "Click for corners, drag for curves; click the first point to close, Enter to finish; double-click a path to edit it" },
  { id: "text", label: "Text", key: "T", hint: "Click to type" },
];

const WIREFRAME = { fill: "#e5e7eb", stroke: "#6b7280", strokeWidth: 1, strokeUniform: true };
const TOP_LEFT = { originX: "left", originY: "top" } as const;
/** Size of a shape placed with a click instead of a drag. */
const DEFAULT_SIZE: Record<DrawingTool, { width: number; height: number }> = {
  frame: { width: 800, height: 500 },
  rect: { width: 160, height: 100 },
  ellipse: { width: 120, height: 120 },
  line: { width: 160, height: 0 },
  polygon: { width: 120, height: 120 },
  pen: { width: 0, height: 0 },
  text: { width: 0, height: 0 },
};

/** The shape a drag from `start` to `end` draws with `tool` (text is placed on click). */
type ShapeTool = Exclude<DrawingTool, "text" | "pen">;

const PEN_STROKE = { fill: "", stroke: "#111827", strokeWidth: 2, strokeUniform: true };
const DISPLAY_ONLY = { selectable: false, evented: false, excludeFromExport: true };

/** A pen path through `anchors`; a closed one gets the wireframe fill. */
function pathFrom(anchors: Anchor[], closed: boolean): Path {
  const path = new Path(toSvgPath(anchors, closed), closed ? { ...WIREFRAME } : { ...PEN_STROKE });
  Object.assign(path, { sfAnchors: anchors, sfClosed: closed });
  return path;
}

/** Points and handle lines shown while drawing or editing a path. */
function anchorMarkers(anchors: Anchor[], zoom: number, withHandles: boolean): FabricObject[] {
  const size = 8 / zoom;
  const markers: FabricObject[] = [];
  for (const a of anchors) {
    if (withHandles) {
      for (const h of [a.in, a.out]) {
        if (!h) continue;
        markers.push(new Line([a.x, a.y, h.x, h.y], { ...DISPLAY_ONLY, stroke: "#3B82F6", strokeWidth: 1 / zoom }));
        markers.push(new Circle({ ...DISPLAY_ONLY, left: h.x, top: h.y, radius: size / 2, fill: "#3B82F6" }));
      }
    }
    markers.push(
      new Rect({ ...DISPLAY_ONLY, left: a.x, top: a.y, width: size, height: size, fill: "#ffffff", stroke: "#3B82F6", strokeWidth: 1 / zoom }),
    );
  }
  return markers;
}

function shapeFor(tool: ShapeTool, start: Point, end: Point, shift: boolean): FabricObject {
  if (tool === "line") {
    const to = snapLine(start, end, shift);
    return new Line([start.x, start.y, to.x, to.y], { stroke: "#374151", strokeWidth: 2, strokeUniform: true });
  }
  const box = dragBox(start, end, shift);
  const at = { ...TOP_LEFT, left: box.left, top: box.top };
  switch (tool) {
    case "frame":
      return new Rect({ ...at, width: box.width, height: box.height, fill: "#ffffff", stroke: "#d4d4d4", strokeWidth: 1 });
    case "rect":
      return new Rect({ ...WIREFRAME, ...at, width: box.width, height: box.height });
    case "ellipse":
      return new Ellipse({ ...WIREFRAME, ...at, rx: box.width / 2, ry: box.height / 2 });
    case "polygon":
      return new Polygon(polygonPoints(3, box), { ...WIREFRAME });
  }
}

export default function CanvasView({ root }: { root: string }) {
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
  const [layers, setLayers] = useState<LayerRow[]>([]);
  const [booleanCount, setBooleanCount] = useState(0);
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
      backgroundColor: "#f5f5f5",
      preserveObjectStacking: true,
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
        setStatus(`Saved ${new Date().toLocaleTimeString()}`);
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
      overlays = drawOverlays(canvas, overlays);
    };
    // Arrow objects come and go on every redraw: only node changes trigger a save.
    const refreshLayers = () => {
      const nodes = canvas.getObjects().filter(isNode);
      const parents = layoutOf(nodes);
      setLayers(
        layerRows(
          nodes.map((n) => ({
            id: n.sfId,
            name: n.sfName,
            kind: n.sfKind,
            parent: parents[n.sfId],
            hidden: !isShown(n),
            locked: !!n.sfLocked,
          })),
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
    const restack = (direction: 1 | -1) => {
      const obj = canvas.getActiveObject() as SfObject | undefined;
      if (!obj || !isNode(obj)) return;
      const nodes = canvas.getObjects().filter(isNode);
      const neighbour = nodes[nodes.indexOf(obj) + direction];
      if (!neighbour) return;
      canvas.moveObjectTo(obj, canvas.getObjects().indexOf(neighbour));
      afterEditRef.current();
    };
    layerOpsRef.current = {
      select: (id) => {
        const obj = nodeById(id);
        if (!obj || !isShown(obj)) return;
        canvas.setActiveObject(obj);
        canvas.requestRenderAll();
        syncSelection();
      },
      rename: (id, name) => {
        const obj = nodeById(id);
        if (!obj) return;
        obj.sfName = name;
        afterEditRef.current();
      },
      toggleHidden: (id) => {
        const obj = nodeById(id);
        if (!obj) return;
        obj.visible = !isShown(obj);
        if (!obj.visible && canvas.getActiveObjects().includes(obj)) canvas.discardActiveObject();
        canvas.requestRenderAll();
        afterEditRef.current();
      },
      toggleLocked: (id) => {
        const obj = nodeById(id);
        if (!obj) return;
        obj.sfLocked = !obj.sfLocked;
        obj.set(lockProps(obj.sfLocked));
        if (obj.sfLocked && canvas.getActiveObjects().includes(obj)) canvas.discardActiveObject();
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
        if (json) await canvas.loadFromJSON(json);
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
      if (t === "select" || t === "pen" || spaceDown) return;
      const start = canvas.getScenePoint(e);
      if (t === "text") {
        const text = new IText("Text", { ...TOP_LEFT, left: start.x, top: start.y, fontSize: 20, fontFamily: "system-ui, sans-serif", fill: "#111827" });
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
      const file = firstImageFile(e.clipboardData?.files);
      if (!file) return;
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
      obj.set({ ...props, fill: typeof fill === "string" ? fill : new Gradient(fill) });
      obj.setCoords();
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
        <div className="absolute left-3 top-3 z-10 flex gap-2">
          <div className="flex overflow-hidden rounded-md border border-neutral-300 bg-white shadow-sm">
            {TOOLBAR.map(({ id, label, key, hint }) => (
              <button
                key={id}
                onClick={() => setTool(id)}
                aria-pressed={tool === id}
                title={`${hint} (${key})`}
                className={`px-3 py-1.5 text-sm ${tool === id ? "bg-neutral-900 text-white" : "hover:bg-neutral-50"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={openPicker}
            title="Pick a window of this desktop. ⌘⇧X from any app captures the window in front."
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm shadow-sm hover:bg-neutral-50"
          >
            Capture window
          </button>
          {booleanCount >= 2 && (
            <div className="flex overflow-hidden rounded-md border border-neutral-300 bg-white shadow-sm">
              {BOOLEAN_OPS.map(({ op, label }) => (
                <button
                  key={op}
                  onClick={() => layerOpsRef.current?.combine(op)}
                  title={op === "subtract" ? "Remove the upper shapes from the bottom one" : `${label} of the selected shapes`}
                  className="px-3 py-1.5 text-sm hover:bg-neutral-50"
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
        <div className="absolute bottom-2 right-3 z-10 text-xs text-neutral-400">{status}</div>
        <div ref={containerRef} data-testid="canvas-root" className="h-full w-full">
          <canvas ref={canvasElRef} />
        </div>
      </div>
      {selected && <NodeInspector node={selected} others={others} onChange={onInspectorChange} />}
    </div>
  );
}
