import { describe, expect, it } from "vitest";
import { MAX_ZOOM, MIN_ZOOM, nextZoom } from "./viewport";

describe("nextZoom", () => {
  it("zooms in on scroll up and out on scroll down", () => {
    expect(nextZoom(1, -100)).toBeGreaterThan(1);
    expect(nextZoom(1, 100)).toBeLessThan(1);
  });

  it("is symmetric: up then down returns to the start", () => {
    expect(nextZoom(nextZoom(1, -120), 120)).toBeCloseTo(1, 10);
  });

  it("stays within bounds", () => {
    expect(nextZoom(MAX_ZOOM, -10_000)).toBe(MAX_ZOOM);
    expect(nextZoom(MIN_ZOOM, 10_000)).toBe(MIN_ZOOM);
  });
});
