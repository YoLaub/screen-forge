import { useEffect, useRef, useState } from "react";
import { addPoint, dragRect, isUsable, outlinePath, type Point, type RegionShape } from "./regionShape";
import { regionCancel, regionFinish, regionFrame } from "./services/backend";

type Mode = "rect" | "path";

const HINT = "Drag over the area to capture.";

/**
 * Full-screen overlay for region capture. It shows the screen as it was when the button was
 * pressed (frozen, so that nothing moves under the pointer) and the user draws a rectangle or
 * an outline on it. The backend cuts the area out of that same shot.
 */
export default function RegionOverlay() {
  const [frame, setFrame] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("rect");
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [from, setFrom] = useState<Point | null>(null);
  const [to, setTo] = useState<Point | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [message, setMessage] = useState<{ text: string; error: boolean }>({ text: HINT, error: false });
  const drawing = useRef(false);

  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    regionFrame().then(
      (jpeg) => setFrame(`data:image/jpeg;base64,${jpeg}`),
      () => regionCancel().catch(() => {}),
    );
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") regionCancel().catch(() => {});
    };
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const at = (e: React.MouseEvent): Point => ({ x: e.clientX, y: e.clientY });

  function start(e: React.MouseEvent) {
    drawing.current = true;
    setMessage({ text: HINT, error: false });
    setFrom(at(e));
    setTo(at(e));
    setPoints([at(e)]);
  }

  function move(e: React.MouseEvent) {
    if (!drawing.current) return;
    setTo(at(e));
    setPoints((current) => addPoint(current, at(e)));
  }

  async function end(e: React.MouseEvent) {
    if (!drawing.current || !from) return;
    drawing.current = false;
    const shape: RegionShape = mode === "rect" ? dragRect(from, at(e)) : { kind: "path", points: addPoint(points, at(e)) };
    if (!isUsable(shape)) {
      setFrom(null);
      setPoints([]);
      setMessage({ text: HINT, error: false });
      return;
    }
    try {
      await regionFinish(shape);
    } catch (error) {
      // The overlay stays open: the area was refused, not the capture.
      setFrom(null);
      setPoints([]);
      setMessage({ text: String(error), error: true });
    }
  }

  const rect = from && to && mode === "rect" ? dragRect(from, to) : null;
  const outline = mode === "path" ? outlinePath(points) : "";
  // Everything is dimmed except the selection (even-odd fill leaves the inside clear).
  const dim = `M0 0H${size.w}V${size.h}H0Z${rect && rect.kind === "rect" ? `M${rect.x} ${rect.y}h${rect.w}v${rect.h}h${-rect.w}Z` : outline}`;

  return (
    <div className="relative h-screen w-screen cursor-crosshair select-none overflow-hidden">
      {frame && <img alt="Frozen screen" src={frame} draggable={false} className="absolute inset-0 h-full w-full" />}
      <svg className="absolute inset-0 h-full w-full" width={size.w} height={size.h}>
        <path d={dim} fill="var(--scrim)" fillRule="evenodd" />
        {rect && rect.kind === "rect" && (
          <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill="none" stroke="var(--acc)" strokeWidth="1.5" />
        )}
        {outline && <path d={outline} fill="none" stroke="var(--acc)" strokeWidth="1.5" />}
      </svg>
      <div
        data-testid="region-surface"
        className="absolute inset-0"
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
      />
      <div className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-[11px] border border-line2 bg-panel px-3 py-2 text-xs text-tx shadow-panel">
        <div className="flex gap-0.5 rounded-lg bg-panel2 p-0.5">
          {(["rect", "path"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`h-6 rounded-md px-2.5 font-medium ${mode === m ? "bg-panel text-tx shadow-panel" : "text-tx2"}`}
            >
              {m === "rect" ? "Rectangle" : "Freehand"}
            </button>
          ))}
        </div>
        <span role={message.error ? "alert" : undefined} className={message.error ? "text-warn" : "text-tx2"}>
          {message.text}
        </span>
        <span className="font-mono text-[10px] text-tx3">Esc to cancel</span>
      </div>
    </div>
  );
}
