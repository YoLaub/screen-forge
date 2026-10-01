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
  lastAgentRead: vi.fn(),
  recentProjects: vi.fn(),
}));

const exportSpy = vi.fn();

// Fabric needs a real canvas; the canvas itself is checked end to end.
vi.mock("./canvas/CanvasView", () => ({
  default: function FakeCanvas(props: {
    root: string;
    onLoaded?: () => void;
    onSaved?: (at: Date) => void;
    onExportLabel?: (label: string) => void;
    controls?: { current: { exportPng: () => Promise<void> } | null };
  }) {
    useEffect(() => {
      props.onSaved?.(new Date(2026, 8, 30, 14, 3));
      props.onExportLabel?.("Export frame");
      if (props.controls) props.controls.current = { exportPng: exportSpy };
    }, []);
    return (
      <div data-testid="canvas-view">
        {props.root}
        <button onClick={props.onLoaded}>finish loading</button>
      </div>
    );
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
    mocked.lastAgentRead.mockResolvedValue(null);
    mocked.recentProjects.mockResolvedValue([]);
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
    mocked.lastAgentRead.mockResolvedValue(null);
    mocked.recentProjects.mockResolvedValue([]);
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
    fireEvent.click(await screen.findByRole("button", { name: /^Export frame/ }));
    expect(exportSpy).toHaveBeenCalledWith({ format: "png", quality: "high" });
  });

  it("exports in the chosen format and remembers it for next time", async () => {
    mocked.agentStatus.mockResolvedValue(NOT_CONNECTED);
    localStorage.clear();
    const { unmount } = render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Export options" }));
    fireEvent.click(screen.getByRole("button", { name: "JPG" }));
    fireEvent.click(screen.getByRole("button", { name: "Medium" }));
    fireEvent.click(screen.getByRole("button", { name: /^Export frame/ }));
    expect(exportSpy).toHaveBeenLastCalledWith({ format: "jpg", quality: "medium" });
    unmount();
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /^Export frame/ }));
    expect(exportSpy).toHaveBeenLastCalledWith({ format: "jpg", quality: "medium" });
    localStorage.clear();
  });
});

describe("Connect AI from the title bar", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocked.lastAgentRead.mockResolvedValue(null);
    mocked.recentProjects.mockResolvedValue([]);
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

describe("Home and opening", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocked.lastAgentRead.mockResolvedValue(null);
    mocked.recentProjects.mockResolvedValue([]);
    mocked.agentStatus.mockResolvedValue(NOT_CONNECTED);
  });

  it("shows the home screen when no project was opened, without the title bar", async () => {
    mocked.getLastProject.mockResolvedValue(null);
    render(<App />);
    expect(await screen.findByRole("heading", { name: "ScreenForge" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export frame" })).not.toBeInTheDocument();
  });

  it("covers the workspace with Opening… until the canvas has loaded", async () => {
    mocked.getLastProject.mockResolvedValue("/work/my-app");
    render(<App />);
    expect(await screen.findByRole("status")).toHaveTextContent("Opening my-app…");
    fireEvent.click(screen.getByRole("button", { name: "finish loading" }));
    expect(screen.queryByText(/Opening my-app/)).not.toBeInTheDocument();
  });

  it("shows Opening… again when another folder is picked", async () => {
    mocked.getLastProject.mockResolvedValue("/work/my-app");
    mocked.pickFolder.mockResolvedValue("/work/other");
    mocked.setLastProject.mockResolvedValue(undefined);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "finish loading" }));
    fireEvent.click(screen.getByRole("button", { name: /my-app/ }));
    expect(await screen.findByRole("status")).toHaveTextContent("Opening other…");
  });

  it("opens the folder picker with Cmd+O from the home screen", async () => {
    mocked.getLastProject.mockResolvedValue(null);
    mocked.pickFolder.mockResolvedValue(null);
    render(<App />);
    await screen.findByRole("heading", { name: "ScreenForge" });
    fireEvent.keyDown(window, { key: "o", metaKey: true });
    expect(mocked.pickFolder).toHaveBeenCalledTimes(1);
  });

  it("opens the folder picker with Cmd+O from the workspace too", async () => {
    mocked.getLastProject.mockResolvedValue("/work/my-app");
    mocked.pickFolder.mockResolvedValue(null);
    render(<App />);
    await screen.findByTestId("canvas-view");
    fireEvent.keyDown(window, { key: "O", metaKey: true });
    expect(mocked.pickFolder).toHaveBeenCalledTimes(1);
  });

  it("leaves a plain O to the Ellipse tool", async () => {
    mocked.getLastProject.mockResolvedValue("/work/my-app");
    render(<App />);
    await screen.findByTestId("canvas-view");
    fireEvent.keyDown(window, { key: "o" });
    expect(mocked.pickFolder).not.toHaveBeenCalled();
  });
});

describe("Last read by an agent", () => {
  const justNow = () => ({ at_ms: Date.now() - 5_000, tool: "get_canvas_snapshot", client: "claude-code", nodes: 8, with_instructions: 4 });

  beforeEach(() => {
    vi.resetAllMocks();
    mocked.getLastProject.mockResolvedValue("/work/my-app");
    mocked.agentStatus.mockResolvedValue({ ...NOT_CONNECTED, claude_code: { available: true, registered: "/app/screenforge-mcp" } });
    mocked.lastAgentRead.mockResolvedValue(null);
    mocked.recentProjects.mockResolvedValue([]);
  });

  it("asks for the open project's last read", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "Claude Code connected" });
    expect(mocked.lastAgentRead).toHaveBeenCalledWith("/work/my-app");
  });

  it("shows in the title bar that the canvas was just read", async () => {
    mocked.lastAgentRead.mockResolvedValue(justNow());
    render(<App />);
    expect(await screen.findByRole("button", { name: "Claude Code read the canvas · just now" })).toBeInTheDocument();
  });

  it("tells in Connect AI who read, when and how much", async () => {
    const read = justNow();
    mocked.lastAgentRead.mockResolvedValue(read);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /read the canvas/ }));
    const at = new Date(read.at_ms);
    const clock = `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
    expect(await screen.findByText(`Claude Code last read the canvas at ${clock} · 8 elements, 4 with instructions`)).toBeInTheDocument();
  });

  it("keeps saying that no agent has read the canvas while none did", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Claude Code connected" }));
    expect(await screen.findByText("No agent has read this canvas yet.")).toBeInTheDocument();
  });
});

describe("Recent projects", () => {
  const recent = [
    { path: "/Users/me/dev/acme-dashboard", name: "acme-dashboard", display: "~/dev/acme-dashboard", opened_ms: Date.now() - 1000 },
    { path: "/Users/me/dev/billing-api", name: "billing-api", display: "~/dev/billing-api", opened_ms: Date.now() - 86_400_000 },
  ];

  beforeEach(() => {
    vi.resetAllMocks();
    mocked.agentStatus.mockResolvedValue(NOT_CONNECTED);
    mocked.lastAgentRead.mockResolvedValue(null);
    mocked.getLastProject.mockResolvedValue(null);
    mocked.recentProjects.mockResolvedValue(recent);
    mocked.setLastProject.mockResolvedValue(undefined);
  });

  it("lists them on the home screen", async () => {
    render(<App />);
    expect(await screen.findByRole("button", { name: /billing-api/ })).toHaveTextContent("~/dev/billing-api");
  });

  it("opens one on click, remembering it", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /billing-api/ }));
    expect(await screen.findByTestId("canvas-view")).toHaveTextContent("/Users/me/dev/billing-api");
    expect(mocked.setLastProject).toHaveBeenCalledWith("/Users/me/dev/billing-api");
    expect(mocked.pickFolder).not.toHaveBeenCalled();
  });

  it("asks again for the list once a project is opened, so it is up to date next time", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /billing-api/ }));
    await screen.findByTestId("canvas-view");
    expect(mocked.recentProjects.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("is still usable when the list cannot be read", async () => {
    mocked.recentProjects.mockRejectedValue(new Error("no config folder"));
    render(<App />);
    expect(await screen.findByRole("button", { name: "Open a folder" })).toBeInTheDocument();
    expect(screen.queryByText("Recent")).not.toBeInTheDocument();
  });

  it("shows the home screen even if the backend answers with something that is not a list", async () => {
    mocked.recentProjects.mockResolvedValue(null as never);
    render(<App />);
    expect(await screen.findByRole("button", { name: "Open a folder" })).toBeInTheDocument();
    expect(screen.queryByText("Recent")).not.toBeInTheDocument();
  });

  it("keeps listing them under the Opening card when the last project reopens at start", async () => {
    mocked.getLastProject.mockResolvedValue("/Users/me/dev/acme-dashboard");
    render(<App />);
    expect(await screen.findByRole("status")).toHaveTextContent("Opening acme-dashboard…");
    expect(await screen.findByRole("button", { name: /billing-api/ })).toBeDisabled();
  });
});
