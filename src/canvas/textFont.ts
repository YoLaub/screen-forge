/**
 * Font of canvas texts. Not the macOS system font: Fabric measures glyphs at
 * 400 px and scales the widths down, but SF Pro draws tighter at large sizes
 * (optical sizing), so its texts got a box too narrow and were cut off.
 */
export const TEXT_FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';

const SYSTEM_FONT = "system-ui, sans-serif";

/** Canvas JSON with the texts saved in the system font moved to TEXT_FONT. */
export function withTextFont(json: string): string {
  const state = JSON.parse(json);
  for (const obj of state.objects ?? []) {
    if (obj.fontFamily === SYSTEM_FONT) obj.fontFamily = TEXT_FONT;
  }
  return JSON.stringify(state);
}
