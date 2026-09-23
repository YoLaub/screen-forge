export interface Bounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Standalone SVG document for one object, framed on its scene bounds. */
export function wrapSvg(fragment: string, b: Bounds): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${b.width}" height="${b.height}" viewBox="${b.left} ${b.top} ${b.width} ${b.height}">${fragment}</svg>`;
}

const PNG_PREFIX = "data:image/png;base64,";

export function dataUrlToBase64(dataUrl: string): string {
  if (!dataUrl.startsWith(PNG_PREFIX)) {
    throw new Error("expected a base64 PNG data URL");
  }
  return dataUrl.slice(PNG_PREFIX.length);
}
