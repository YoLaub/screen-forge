export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;

/** Zoom level after a wheel event: exponential in deltaY, so up then down cancels out. */
export function nextZoom(current: number, deltaY: number): number {
  const zoom = current * 0.999 ** deltaY;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}
