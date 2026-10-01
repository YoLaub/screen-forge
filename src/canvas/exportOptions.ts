export type ExportFormat = "png" | "jpg" | "webp";
export type ExportQuality = "low" | "medium" | "high";

export interface ExportSettings {
  format: ExportFormat;
  quality: ExportQuality;
}

export const EXPORT_FORMATS: ExportFormat[] = ["png", "jpg", "webp"];
export const EXPORT_QUALITIES: ExportQuality[] = ["low", "medium", "high"];
export const DEFAULT_EXPORT: ExportSettings = { format: "png", quality: "high" };

/** PNG is lossless: quality only changes JPG and WebP. */
export function usesQuality(format: ExportFormat): boolean {
  return format !== "png";
}

/** `name` with its extension replaced by the format's (added when it has none). */
export function withExtension(name: string, format: ExportFormat): string {
  const dot = name.lastIndexOf(".");
  const known = dot > 0 && /^(png|jpe?g|webp)$/i.test(name.slice(dot + 1));
  return `${known ? name.slice(0, dot) : name}.${format}`;
}

/** Saved settings, field by field: whatever is not valid falls back to the default. */
export function parseExportSettings(json: string | null): ExportSettings {
  try {
    const raw = json ? JSON.parse(json) : {};
    return {
      format: EXPORT_FORMATS.includes(raw?.format) ? raw.format : DEFAULT_EXPORT.format,
      quality: EXPORT_QUALITIES.includes(raw?.quality) ? raw.quality : DEFAULT_EXPORT.quality,
    };
  } catch {
    return DEFAULT_EXPORT;
  }
}
