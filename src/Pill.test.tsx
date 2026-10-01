import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Pill from "./Pill";
import * as backend from "./services/backend";

vi.mock("./services/backend", () => ({
  agentStatus: vi.fn(),
  captureFront: vi.fn(),
  getLastProject: vi.fn(),
  lastAgentRead: vi.fn(),
  onCanvasSummary: vi.fn(),
  onCaptured: vi.fn(),
  onCaptureFailed: vi.fn(),
  pillSetState: vi.fn(),
  pillSetTop: vi.fn(),
  sendPillRequest: vi.fn(),
  showMainWindow: vi.fn(),
}));

const mocked = vi.mocked(backend);

const CONNECTED = {
  mcp_binary: { Ok: "/app/screenforge-mcp" },
  claude_code: { available: true, registered: "/app/screenforge-mcp" },
  claude_desktop: { available: false, registered: null },
};
const CAPTURE = {
  window: { id: 7, app_name: "Safari", title: "localhost:5173/login", width: 1280, height: 864 },
  png_base64: "AAAA",
};

let emitCaptured: (c: typeof CAPTURE) => void;
let emitSummary: (n: number) => void;
let emitFailed: (m: string) => void;

beforeEach(() => {
  vi.resetAllMocks();
  mocked.agentStatus.mockResolvedValue(CONNECTED);
  mocked.getLastProject.mockResolvedValue("/p");
  mocked.lastAgentRead.mockResolvedValue(null);
  mocked.pillSetState.mockResolvedValue();
  mocked.captureFront.mockResolvedValue();
  mocked.sendPillRequest.mockResolvedValue();
  mocked.showMainWindow.mockResolvedValue();
  mocked.onCaptured.mockImplementation(async (h) => {
    emitCaptured = h;
    return () => {};
  });
  mocked.onCanvasSummary.mockImplementation(async (h) => {
    emitSummary = h;
    return () => {};
  });
  mocked.onCaptureFailed.mockImplementation(async (h) => {
    emitFailed = h;
    return () => {};
  });
});

async function open() {
  render(<Pill />);
  await act(async () => {});
  fireEvent.mouseEnter(screen.getByTestId("pill"));
}

describe("Pill", () => {
  it("starts as a tab and opens its actions on hover, resizing the window", async () => {
    render(<Pill />);
    await act(async () => {});
    expect(screen.queryByRole("button", { name: "Capture frontmost window" })).toBeNull();
    fireEvent.mouseEnter(screen.getByTestId("pill"));
    expect(screen.getByRole("button", { name: "Capture frontmost window" })).toBeInTheDocument();
    expect(mocked.pillSetState).toHaveBeenLastCalledWith("expanded");
    fireEvent.mouseLeave(screen.getByTestId("pill"));
    expect(mocked.pillSetState).toHaveBeenLastCalledWith("collapsed");
  });

  it("asks the canvas for its summary once it listens", async () => {
    render(<Pill />);
    await act(async () => {});
    expect(mocked.sendPillRequest).toHaveBeenCalledWith({ kind: "hello" });
  });

  it("says in words what each action does", async () => {
    await open();
    expect(screen.getByText("Adds the window in front to the canvas")).toBeInTheDocument();
    expect(screen.getByText("Pick which window to capture")).toBeInTheDocument();
    expect(screen.getByText("Adds the copied image to the canvas")).toBeInTheDocument();
    expect(screen.getByText("Shows the main window")).toBeInTheDocument();
  });

  it("captures the window in front from the first button", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Capture frontmost window" }));
    expect(mocked.captureFront).toHaveBeenCalledTimes(1);
  });

  it("asks the canvas to open the picker or paste, and brings the app forward", async () => {
    await open();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Choose a window…" })));
    expect(mocked.showMainWindow).toHaveBeenCalled();
    expect(mocked.sendPillRequest).toHaveBeenLastCalledWith({ kind: "pick" });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Paste image from clipboard" })));
    expect(mocked.sendPillRequest).toHaveBeenLastCalledWith({ kind: "paste" });
  });

  it("opens the canvas", async () => {
    await open();
    mocked.showMainWindow.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Open ScreenForge canvas" }));
    expect(mocked.showMainWindow).toHaveBeenCalledTimes(1);
  });

  it("shows the agent and the number of instructions on the canvas", async () => {
    await open();
    act(() => emitSummary(4));
    expect(screen.getByText("Claude Code connected · 4 instructions on canvas")).toBeInTheDocument();
  });

  it("shows a card after a capture, with the source and the thumbnail", async () => {
    await open();
    act(() => emitCaptured(CAPTURE));
    expect(screen.getByText("Captured to canvas")).toBeInTheDocument();
    expect(screen.getByText("Safari — localhost:5173/login")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Capture thumbnail" })).toHaveAttribute("src", "data:image/png;base64,AAAA");
    expect(mocked.pillSetState).toHaveBeenLastCalledWith("captured");
  });

  it("sends the instructions typed on the card to the canvas", async () => {
    await open();
    act(() => emitCaptured(CAPTURE));
    fireEvent.change(screen.getByPlaceholderText("Tell the agent what to do with it…"), { target: { value: "Make it red" } });
    expect(mocked.sendPillRequest).toHaveBeenLastCalledWith({ kind: "instructions", text: "Make it red" });
  });

  it("undoes the capture and goes back to the tab", async () => {
    await open();
    act(() => emitCaptured(CAPTURE));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(mocked.sendPillRequest).toHaveBeenLastCalledWith({ kind: "undo" });
    expect(mocked.pillSetState).toHaveBeenLastCalledWith("collapsed");
  });

  it("opens the app from the card and goes back to the tab", async () => {
    await open();
    act(() => emitCaptured(CAPTURE));
    mocked.showMainWindow.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Open in ScreenForge" }));
    expect(mocked.showMainWindow).toHaveBeenCalled();
    expect(mocked.pillSetState).toHaveBeenLastCalledWith("collapsed");
  });

  it("closes the card with Escape", async () => {
    await open();
    act(() => emitCaptured(CAPTURE));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByText("Captured to canvas")).toBeNull();
  });

  it("says why a capture failed", async () => {
    await open();
    act(() => emitFailed("No window to capture on this desktop."));
    expect(screen.getByRole("alert")).toHaveTextContent("No window to capture on this desktop.");
  });
});
