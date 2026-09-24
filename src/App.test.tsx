import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import * as backend from "./services/backend";

vi.mock("./services/backend", () => ({
  getLastProject: vi.fn(),
  setLastProject: vi.fn(),
  pickFolder: vi.fn(),
}));

// Fabric needs a real canvas; the canvas itself is checked end to end.
vi.mock("./canvas/CanvasView", () => ({
  default: ({ root }: { root: string }) => <div data-testid="canvas-view">{root}</div>,
}));

const mocked = vi.mocked(backend);

describe("App", () => {
  beforeEach(() => vi.resetAllMocks());

  it("asks for a folder when no project was opened before", async () => {
    mocked.getLastProject.mockResolvedValue(null);
    render(<App />);
    expect(await screen.findByRole("button", { name: "Open a folder" })).toBeInTheDocument();
    expect(screen.queryByTestId("canvas-view")).not.toBeInTheDocument();
  });

  it("reopens the last project on the canvas", async () => {
    mocked.getLastProject.mockResolvedValue("/work/my-app");
    render(<App />);
    expect(await screen.findByTestId("canvas-view")).toHaveTextContent("/work/my-app");
    expect(screen.getByText("my-app")).toBeInTheDocument();
  });

  it("opens and remembers the picked folder", async () => {
    mocked.getLastProject.mockResolvedValue(null);
    mocked.pickFolder.mockResolvedValue("/work/other");
    mocked.setLastProject.mockResolvedValue(undefined);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Open a folder" }));
    expect(await screen.findByTestId("canvas-view")).toHaveTextContent("/work/other");
    expect(mocked.setLastProject).toHaveBeenCalledWith("/work/other");
  });

  it("stays on the welcome screen when the picker is cancelled", async () => {
    mocked.getLastProject.mockResolvedValue(null);
    mocked.pickFolder.mockResolvedValue(null);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Open a folder" }));
    await Promise.resolve();
    expect(screen.queryByTestId("canvas-view")).not.toBeInTheDocument();
    expect(mocked.setLastProject).not.toHaveBeenCalled();
  });
});
