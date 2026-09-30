/**
 * Default colors of what the user draws. They are content, not theme: saved in the
 * canvas and sent to the agent, so they do not change with the macOS appearance.
 */
// One annotation color, the mockup's red-orange (#ff4d2e) darkened to reach 3:1 on
// both the light and the dark canvas (contrast.test.ts).
const ANNOTATION = "#e8411f";

export const DRAWING = {
  shapeFill: "#e5e7eb",
  shapeStroke: "#6b7280",
  pen: ANNOTATION,
  line: ANNOTATION,
  text: ANNOTATION,
  cross: ANNOTATION,
  frameFill: "#ffffff",
  frameStroke: "#d4d4d4",
  gradientEnd: "#FFFFFF",
  /** Background of the canvas and frame images sent to the agent or exported. */
  renderBackground: "#f5f5f5",
};

/**
 * New rectangles, ellipses, polygons and closed pen paths: an annotation outline
 * with no fill (mockup), so a shape drawn on a capture never hides what it circles.
 * `shapeFill` stays the color proposed when the user turns a fill on.
 */
export const SHAPE_STYLE = { fill: "", stroke: ANNOTATION, strokeWidth: 2, strokeUniform: true };
