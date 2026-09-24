import { Canvas, FabricImage, FabricObject, Path, Point, Rect } from "fabric";
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
import { dataUrlToBase64, wrapSvg } from "./exportNode";
import { arrowBetween, arrowHead } from "./geometry";
import { firstImageFile } from "./imageFile";
import { pruneLinks } from "./links";
import NodeInspector, { type InspectorNode, type InspectorPatch } from "./NodeInspector";
import WindowPicker, { captureName, type WindowInfo } from "./WindowPicker";
import { type NodeKind, type SfProps, SF_PROPS, newNodeId, nextNodeName, toNodeRecord } from "./nodeRecord";
import { nextZoom } from "./viewport";

// Serialize the ScreenForge props with every object in canvas.json.
FabricObject.customProperties = SF_PROPS;

type SfObject = FabricObject & Partial<SfProps>;

const AUTOSAVE_DELAY_MS = 500;

function isNode(obj: SfObject): obj is FabricObject & SfProps {
  return typeof obj.sfId === "string";
}

function exportNode(obj: FabricObject & SfProps): NodeExportDto {
  const node = toNodeRecord(obj);
  if (obj.sfKind === "capture") {
    // Captures are bitmaps: export at native resolution, no SVG (it would only wrap the PNG).
    const png = obj.toDataURL({ format: "png", multiplier: 1 / (obj.scaleX || 1) });
    return { node, svg: null, png_base64: dataUrlToBase64(png) };
  }
  const png = obj.toDataURL({ format: "png", multiplier: 1 });
  return { node, svg: wrapSvg(obj.toSVG(), obj.getBoundingRect()), png_base64: dataUrlToBase64(png) };
}

function toInspectorNode(obj: FabricObject & SfProps): InspectorNode {
  return {
    id: obj.sfId,
    kind: obj.sfKind,
    name: obj.sfName,
    instructions: obj.sfInstructions,
    links: obj.sfLinks ?? [],
  };
}

/** Link arrows are display only: rebuilt from sfLinks, never saved. */
function drawArrows(canvas: Canvas, previous: FabricObject[]): FabricObject[] {
  previous.forEach((a) => canvas.remove(a));
  const nodes = canvas.getObjects().filter(isNode);
  const byId = new Map(nodes.map((n) => [n.sfId, n]));
  const arrows: FabricObject[] = [];
  for (const source of nodes) {
    for (const link of source.sfLinks ?? []) {
      const target = byId.get(link.target_node);
      if (!target) continue;
      const line = arrowBetween(source.getBoundingRect(), target.getBoundingRect());
      if (!line) continue;
      const [b1, b2] = arrowHead(line.from, line.to, 12);
      const d = `M ${line.from.x} ${line.from.y} L ${line.to.x} ${line.to.y} M ${b1.x} ${b1.y} L ${line.to.x} ${line.to.y} L ${b2.x} ${b2.y}`;
      const arrow = new Path(d, {
        fill: "",
        stroke: "#64748b",
        strokeWidth: 2,
        selectable: false,
        evented: false,
        excludeFromExport: true,
      });
      canvas.add(arrow);
      canvas.sendObjectToBack(arrow);
      arrows.push(arrow);
    }
  }
  canvas.requestRenderAll();
  return arrows;
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

export default function CanvasView({ root }: { root: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<InspectorNode | null>(null);
  const [others, setOthers] = useState<{ id: string; name: string }[]>([]);
  // Set inside the canvas effect, used by inspector edits.
  const afterEditRef = useRef<() => void>(() => {});
  const addImageRef = useRef<(dataUrl: string, name?: string) => Promise<void>>(async () => {});
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
        const nodes = canvas.getObjects().filter(isNode).map(exportNode);
        await saveCanvas(root, JSON.stringify(canvas.toObject()), nodes);
        setStatus(`Saved ${new Date().toLocaleTimeString()}`);
      },
      AUTOSAVE_DELAY_MS,
      (error) => setStatus(`Save failed: ${String(error)}`),
    );
    let arrows: FabricObject[] = [];
    const redrawArrows = () => {
      arrows = drawArrows(canvas, arrows);
    };
    // Arrow objects come and go on every redraw: only node changes trigger a save.
    const onChange = ({ target }: { target: SfObject }) => {
      if (loading || !isNode(target)) return;
      redrawArrows();
      autosave.schedule();
    };
    canvas.on("object:added", onChange);
    canvas.on("object:modified", onChange);
    canvas.on("object:removed", onChange);
    canvas.on("object:moving", redrawArrows);
    canvas.on("object:scaling", redrawArrows);

    const syncSelection = () => {
      const active = canvas.getActiveObjects() as SfObject[];
      const node = active.length === 1 && isNode(active[0]) ? active[0] : null;
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
      autosave.schedule();
    };

    loadCanvas(root)
      .then(async (json) => {
        if (json) await canvas.loadFromJSON(json);
        redrawArrows();
      })
      .catch((error) => setStatus(`Load failed: ${String(error)}`))
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
      if (e.key === "Backspace" || e.key === "Delete") {
        canvas.getActiveObjects().forEach((o) => canvas.remove(o));
        canvas.discardActiveObject();
        // Links pointing at removed nodes go with them.
        const remaining = canvas.getObjects().filter(isNode);
        const ids = new Set(remaining.map((n) => n.sfId));
        remaining.forEach((n) => (n.sfLinks = pruneLinks(n.sfLinks ?? [], ids)));
        redrawArrows();
        autosave.schedule();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceDown = false;
        canvas.selection = true;
        canvas.defaultCursor = "default";
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
    afterEditRef.current();
  }

  function addRectangle() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const center = canvas.getVpCenter();
    const rect = new Rect({
      left: center.x,
      top: center.y,
      width: 160,
      height: 100,
      rx: 8,
      ry: 8,
      fill: "#3B82F6",
    });
    tagAsNode(canvas, rect, "vector_drawing");
    canvas.add(rect);
    canvas.setActiveObject(rect);
  }

  return (
    <div className="flex min-h-0 flex-1">
      {/* min-w-0: a flex item never shrinks below its content (the fixed-size <canvas>)
          otherwise, which pushes the inspector off screen. */}
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <div className="absolute left-3 top-3 z-10 flex gap-2">
          <button
            onClick={addRectangle}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm shadow-sm hover:bg-neutral-50"
          >
            Rectangle
          </button>
          <button
            onClick={openPicker}
            title="Pick a window of this desktop. ⌘⇧X from any app captures the window in front."
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm shadow-sm hover:bg-neutral-50"
          >
            Capture window
          </button>
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
