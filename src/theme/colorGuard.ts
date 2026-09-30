/** Tailwind palette color classes (a background in neutral 100, white text…): they bypass the theme. */
export function paletteClasses(text: string): string[] {
  const re =
    /\b(?:bg|text|border|ring|accent|outline|divide|placeholder|from|to|via|fill|stroke|shadow|decoration|caret)-(?:white|black|neutral|gray|slate|zinc|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d{2,3})?(?:\/\d+)?\b/g;
  return text.match(re) ?? [];
}

/** Hex color literals (3, 6 or 8 digits) and rgb or rgba functions. */
export function colorLiterals(text: string): string[] {
  return text.match(/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b|rgba?\(/g) ?? [];
}
