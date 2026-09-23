import { Canvas, FabricImage, FabricObject, Point, Rect } from "fabric";
import { useEffect, useRef, useState } from "react";
import { loadCanvas, saveCanvas, type NodeExportDto } from "../services/backend";
import { createAutosave } from "./autosave";
import { dataUrlToBase64, wrapSvg } from "./exportNode";
import { firstImageFile } from "./imageFile";
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

function tagAsNode(canvas: Canvas, obj: FabricObject, kind: NodeKind) {
  const names = canvas.getObjects().filter(isNode).map((o) => o.sfName);
  const props: SfProps = {
    sfId: newNodeId(kind),
    sfKind: kind,
    sfName: nextNodeName(kind, names),
    sfInstructions: "",
  };
  Object.assign(obj, props);
}

export default function CanvasView({ root }: { root: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const [status, setStatus] = useState("");

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
    const onChange = () => {
      if (!loading) autosave.schedule();
    };
    canvas.on("object:added", onChange);
    canvas.on("object:modified", onChange);
    canvas.on("object:removed", onChange);

    loadCanvas(root)
      .then(async (json) => {
        if (json) await canvas.loadFromJSON(json);
        canvas.requestRenderAll();
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
      if (e.key === "Backspace" || e.key === "Delete") {
        canvas.getActiveObjects().forEach((o) => canvas.remove(o));
        canvas.discardActiveObject();
        canvas.requestRenderAll();
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

    // An image pasted (Cmd+V) or dropped on the canvas becomes a capture node.
    const addCapture = async (file: File, at: Point) => {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const image = await FabricImage.fromURL(dataUrl);
      tagAsNode(canvas, image, "capture");
      // Fabric 7 objects are positioned by their center (originX/Y default to "center").
      image.set({ left: at.x, top: at.y });
      canvas.add(image);
      canvas.setActiveObject(image);
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

    return () => {
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
    <div className="relative flex-1">
      <div className="absolute left-3 top-3 z-10 flex gap-2">
        <button
          onClick={addRectangle}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm shadow-sm hover:bg-neutral-50"
        >
          Rectangle
        </button>
      </div>
      <div className="absolute bottom-2 right-3 z-10 text-xs text-neutral-400">{status}</div>
      <div ref={containerRef} data-testid="canvas-root" className="h-full w-full">
        <canvas ref={canvasElRef} />
      </div>
    </div>
  );
}
