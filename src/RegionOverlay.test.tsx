import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RegionOverlay from "./RegionOverlay";
import * as backend from "./services/backend";

vi.mock("./services/backend", () => ({
  regionCancel: vi.fn(),
  regionFinish: vi.fn(),
  regionFrame: vi.fn(),
}));

const mocked = vi.mocked(backend);

beforeEach(() => {
  vi.resetAllMocks();
  mocked.regionFrame.mockResolvedValue("AAAA");
  mocked.regionFinish.mockResolvedValue();
  mocked.regionCancel.mockResolvedValue();
});

async function open() {
  render(<RegionOverlay />);
  await act(async () => {});
  return screen.getByTestId("region-surface");
}

function drag(surface: HTMLElement, points: [number, number][]) {
  const [first, ...rest] = points;
  fireEvent.mouseDown(surface, { clientX: first[0], clientY: first[1] });
  for (const [x, y] of rest) fireEvent.mouseMove(surface, { clientX: x, clientY: y });
  const [lastX, lastY] = points[points.length - 1];
  fireEvent.mouseUp(surface, { clientX: lastX, clientY: lastY });
}

describe("RegionOverlay", () => {
  it("shows the frozen screen shot", async () => {
    await open();
    expect(screen.getByRole("img", { name: "Frozen screen" })).toHaveAttribute("src", "data:image/jpeg;base64,AAAA");
  });

  it("captures the rectangle that was dragged", async () => {
    const surface = await open();
    drag(surface, [[100, 120], [300, 260]]);
    expect(mocked.regionFinish).toHaveBeenCalledWith({ kind: "rect", x: 100, y: 120, w: 200, h: 140 });
  });

  it("captures the outline that was drawn, in freehand mode", async () => {
    const surface = await open();
    fireEvent.click(screen.getByRole("button", { name: "Freehand" }));
    drag(surface, [[100, 100], [200, 100], [200, 200], [100, 200]]);
    expect(mocked.regionFinish).toHaveBeenCalledWith({
      kind: "path",
      points: [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
        { x: 200, y: 200 },
        { x: 100, y: 200 },
      ],
    });
  });

  it("does not send an area that is only a click", async () => {
    const surface = await open();
    drag(surface, [[100, 100], [101, 101]]);
    expect(mocked.regionFinish).not.toHaveBeenCalled();
    expect(screen.getByText("Drag over the area to capture.")).toBeInTheDocument();
  });

  it("cancels with Escape", async () => {
    await open();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(mocked.regionCancel).toHaveBeenCalledTimes(1);
  });

  it("says why the backend refused the area and lets the user draw again", async () => {
    mocked.regionFinish.mockRejectedValue("The selected area is too small.");
    const surface = await open();
    drag(surface, [[100, 100], [300, 300]]);
    await act(async () => {});
    expect(screen.getByRole("alert")).toHaveTextContent("The selected area is too small.");
    expect(mocked.regionCancel).not.toHaveBeenCalled();
  });

  it("closes itself when the screen shot cannot be loaded", async () => {
    mocked.regionFrame.mockRejectedValue("No region capture is in progress.");
    render(<RegionOverlay />);
    await act(async () => {});
    expect(mocked.regionCancel).toHaveBeenCalled();
  });
});
