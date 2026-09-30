import { describe, expect, it } from "vitest";
import { MAX_ZOOM, MIN_ZOOM, fitTransform, nextZoom, stepZoom, zoomKey, zoomLabel } from "./viewport";

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

describe("stepZoom", () => {
  it("steps by 25 %: in is x1.25, out is x0.8, so in then out returns", () => {
    expect(stepZoom(1, "in")).toBe(1.25);
    expect(stepZoom(1, "out")).toBe(0.8);
    expect(stepZoom(stepZoom(0.6, "in"), "out")).toBeCloseTo(0.6, 10);
  });

  it("stays within the same bounds as the wheel", () => {
    expect(stepZoom(MAX_ZOOM, "in")).toBe(MAX_ZOOM);
    expect(stepZoom(MIN_ZOOM, "out")).toBe(MIN_ZOOM);
  });
});

describe("zoomLabel", () => {
  it("shows a whole percentage", () => {
    expect(zoomLabel(0.8)).toBe("80%");
    expect(zoomLabel(1.2549)).toBe("125%");
    expect(zoomLabel(8)).toBe("800%");
  });
});

describe("fitTransform", () => {
  const view = { width: 1000, height: 700 };
  const insets = { top: 90, right: 50, bottom: 60, left: 50 };

  it("fits the box in the free area and centers it", () => {
    const [a, b, c, d, e, f] = fitTransform({ left: 0, top: 0, width: 1000, height: 500 }, view, insets);
    expect([a, b, c, d]).toEqual([0.9, 0, 0, 0.9]);
    expect(e).toBeCloseTo(50, 6);
    expect(f).toBeCloseTo(140, 6);
  });

  it("never zooms in past 100 %, and centers a small box", () => {
    const [a, , , , e, f] = fitTransform({ left: 0, top: 0, width: 100, height: 50 }, view, insets);
    expect(a).toBe(1);
    expect(e).toBeCloseTo(450, 6);
    expect(f).toBeCloseTo(340, 6);
  });

  it("goes down to the minimum zoom for a huge canvas", () => {
    expect(fitTransform({ left: 0, top: 0, width: 100_000, height: 100_000 }, view, insets)[0]).toBe(MIN_ZOOM);
  });
});

describe("zoomKey", () => {
  const key = (k: string, extra: Partial<KeyboardEvent> = {}) =>
    ({ key: k, code: "", metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...extra }) as KeyboardEvent;

  it("maps Cmd + / Cmd = and Cmd - to zoom in and out", () => {
    expect(zoomKey(key("=", { metaKey: true }))).toBe("in");
    expect(zoomKey(key("+", { metaKey: true, shiftKey: true }))).toBe("in");
    expect(zoomKey(key("-", { metaKey: true }))).toBe("out");
  });

  it("maps Shift+1 to fit on the key position, so AZERTY works too", () => {
    expect(zoomKey(key("!", { code: "Digit1", shiftKey: true }))).toBe("fit");
    expect(zoomKey(key("1", { code: "Digit1", shiftKey: true }))).toBe("fit");
  });

  it("ignores the keys alone and other combinations", () => {
    expect(zoomKey(key("=", {}))).toBeUndefined();
    expect(zoomKey(key("1", { code: "Digit1" }))).toBeUndefined();
    expect(zoomKey(key("1", { code: "Digit1", shiftKey: true, metaKey: true }))).toBeUndefined();
  });
});
