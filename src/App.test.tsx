import { fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import * as backend from "./services/backend";

vi.mock("./services/backend", () => ({
  getLastProject: vi.fn(),
  setLastProject: vi.fn(),
  pickFolder: vi.fn(),
  agentStatus: vi.fn(),
  configureAgent: vi.fn(),
}));

const exportSpy = vi.fn();

// Fabric needs a real canvas; the canvas itself is checked end to end.
vi.mock("./canvas/CanvasView", () => ({
  default: function FakeCanvas(props: {
    root: string;
    onSaved?: (at: Date) => void;
    onExportLabel?: (label: string) => void;
    controls?: { current: { exportPng: () => Promise<void> } | null };
  }) {
    useEffect(() => {
      props.onSaved?.(new Date(2026, 8, 30, 14, 3));
      props.onExportLabel?.("Export frame");
      if (props.controls) props.controls.current = { exportPng: exportSpy };
    }, []);
    return <div data-testid="canvas-view">{props.root}</div>;
  },
}));

const NOT_CONNECTED = {
  mcp_binary: { Ok: "/app/screenforge-mcp" },
  claude_code: { available: true, registered: null },
  claude_desktop: { available: false, registered: null },
};

const mocked = vi.mocked(backend);

describe("App", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocked.agentStatus.mockResolvedValue(NOT_CONNECTED);
  });

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

describe("title bar", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocked.getLastProject.mockResolvedValue("/work/my-app");
  });

  it("switches folder from the project name", async () => {
    mocked.agentStatus.mockResolvedValue(NOT_CONNECTED);
    mocked.pickFolder.mockResolvedValue(null);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /my-app/ }));
    expect(mocked.pickFolder).toHaveBeenCalled();
  });

  it("shows when the canvas was last saved", async () => {
    mocked.agentStatus.mockResolvedValue(NOT_CONNECTED);
    render(<App />);
    expect(await screen.findByText("Saved 14:03")).toBeInTheDocument();
  });

  it("offers Connect AI when no agent points at this app", async () => {
    mocked.agentStatus.mockResolvedValue(NOT_CONNECTED);
    render(<App />);
    expect(await screen.findByRole("button", { name: "Connect AI" })).toBeInTheDocument();
  });

  it("names the connected agent", async () => {
    mocked.agentStatus.mockResolvedValue({ ...NOT_CONNECTED, claude_code: { available: true, registered: "/app/screenforge-mcp" } });
    render(<App />);
    expect(await screen.findByRole("button", { name: "Claude Code connected" })).toBeInTheDocument();
  });

  it("exports from the title bar, labeled by the canvas selection", async () => {
    mocked.agentStatus.mockResolvedValue(NOT_CONNECTED);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Export frame" }));
    expect(exportSpy).toHaveBeenCalled();
  });
});

describe("Connect AI from the title bar", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocked.getLastProject.mockResolvedValue("/work/my-app");
    mocked.agentStatus.mockResolvedValue(NOT_CONNECTED);
  });

  it("opens the dialog on the open project and connects a client", async () => {
    mocked.configureAgent.mockResolvedValue(undefined);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Connect AI" }));
    expect(await screen.findByText("my-app/.screenforge")).toBeInTheDocument();
    mocked.agentStatus.mockResolvedValue({ ...NOT_CONNECTED, claude_code: { available: true, registered: "/app/screenforge-mcp" } });
    fireEvent.click(screen.getByRole("button", { name: "Connect Claude Code" }));
    expect(mocked.configureAgent).toHaveBeenCalledWith("claude_code");
    expect(await screen.findByText(/Restart running Claude Code sessions/)).toBeInTheDocument();
    expect(screen.getByTestId("claude_code-state")).toHaveTextContent("Connected");
  });

  it("shows why connecting failed and lets the user retry", async () => {
    mocked.configureAgent.mockRejectedValue("permission denied");
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Connect AI" }));
    fireEvent.click(await screen.findByRole("button", { name: "Connect Claude Code" }));
    expect(await screen.findByText("Couldn’t connect: permission denied")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry Claude Code" })).toBeEnabled();
  });

  it("forgets the last attempt when the dialog is opened again", async () => {
    mocked.configureAgent.mockRejectedValue("permission denied");
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Connect AI" }));
    fireEvent.click(await screen.findByRole("button", { name: "Connect Claude Code" }));
    await screen.findByText("Couldn’t connect: permission denied");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(await screen.findByRole("button", { name: "Connect AI" }));
    expect(await screen.findByRole("button", { name: "Connect Claude Code" })).toBeEnabled();
    expect(screen.queryByText(/Couldn’t connect/)).not.toBeInTheDocument();
  });
});
