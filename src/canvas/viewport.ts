export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;

/** Zoom level after a wheel event: exponential in deltaY, so up then down cancels out. */
export function nextZoom(current: number, deltaY: number): number {
  const zoom = current * 0.999 ** deltaY;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

/** One step of the zoom buttons and shortcuts (mockup: x1.25 in, x0.8 out). */
export function stepZoom(current: number, direction: "in" | "out"): number {
  return clampZoom(direction === "in" ? current * 1.25 : current * 0.8);
}

export function zoomLabel(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Viewport transform that shows `box` (scene units) entirely in the free area of a
 * `view` (pixels) left by the floating controls, centered. Never magnifies past 100 %.
 */
export function fitTransform(
  box: { left: number; top: number; width: number; height: number },
  view: { width: number; height: number },
  insets: Insets,
): [number, number, number, number, number, number] {
  const freeW = view.width - insets.left - insets.right;
  const freeH = view.height - insets.top - insets.bottom;
  const zoom = clampZoom(Math.min(freeW / box.width, freeH / box.height, 1));
  const tx = insets.left + freeW / 2 - zoom * (box.left + box.width / 2);
  const ty = insets.top + freeH / 2 - zoom * (box.top + box.height / 2);
  return [zoom, 0, 0, zoom, tx, ty];
}

/**
 * Zoom shortcut of a key event: Cmd + or Cmd = in, Cmd - out, Shift+1 fit all.
 * Shift+1 is read from the key position (`code`), since the character it types
 * differs between QWERTY ("!") and AZERTY ("1").
 */
export function zoomKey(e: Pick<KeyboardEvent, "key" | "code" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey">): "in" | "out" | "fit" | undefined {
  if (e.altKey) return undefined;
  if (e.metaKey || e.ctrlKey) {
    if (e.key === "=" || e.key === "+") return "in";
    if (e.key === "-" || e.key === "_") return "out";
    return undefined;
  }
  return e.shiftKey && e.code === "Digit1" ? "fit" : undefined;
}
