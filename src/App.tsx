import { useEffect, useRef, useState } from "react";
import AgentSetup, { type AgentClient, type AgentStatus } from "./AgentSetup";
import CanvasView, { type CanvasControls } from "./canvas/CanvasView";
import TitleBar from "./TitleBar";
import { agentPill } from "./titleBarState";
import {
  agentStatus,
  configureAgent,
  getLastProject,
  pickFolder,
  setLastProject,
} from "./services/backend";

const CONNECTED_HINT: Record<AgentClient, string> = {
  claude_code: "Connected for every project. Restart running Claude Code sessions to use it.",
  claude_desktop: "Connected. Quit and reopen Claude Desktop to load it.",
};

type ProjectState = { status: "loading" } | { status: "none" } | { status: "open"; root: string };

function folderName(root: string): string {
  return root.split("/").filter(Boolean).pop() ?? root;
}

export default function App() {
  const [project, setProject] = useState<ProjectState>({ status: "loading" });
  const [agents, setAgents] = useState<AgentStatus | null>(null);
  const [agentBusy, setAgentBusy] = useState<AgentClient | null>(null);
  const [agentMessages, setAgentMessages] = useState<Partial<Record<AgentClient, string>>>({});
  // The title bar shows the agent state without opening the dialog.
  const [agentState, setAgentState] = useState<AgentStatus | null>(null);
  const [saved, setSaved] = useState<Date | null>(null);
  const [exportLabel, setExportLabel] = useState<string | null>(null);
  const canvasControls = useRef<CanvasControls | null>(null);

  const refreshAgents = async () => {
    const status = await agentStatus();
    setAgentState(status);
    return status;
  };

  useEffect(() => {
    getLastProject().then((root) =>
      setProject(root ? { status: "open", root } : { status: "none" }),
    );
    refreshAgents().catch(() => {});
  }, []);

  async function openFolder() {
    const root = await pickFolder();
    if (!root) return;
    await setLastProject(root);
    setSaved(null);
    setProject({ status: "open", root });
  }

  async function openAgents() {
    setAgentMessages({});
    setAgents(await refreshAgents());
  }

  async function configure(client: AgentClient) {
    setAgentBusy(client);
    try {
      await configureAgent(client);
      setAgentMessages((m) => ({ ...m, [client]: CONNECTED_HINT[client] }));
    } catch (error) {
      setAgentMessages((m) => ({ ...m, [client]: `Failed: ${String(error)}` }));
    } finally {
      setAgentBusy(null);
      setAgents(await refreshAgents());
    }
  }

  if (project.status === "loading") return null;

  if (project.status === "none") {
    return (
      <main className="flex h-screen w-screen flex-col bg-bg">
        {/* Room for the traffic lights, and a handle to move the window. */}
        <div data-tauri-drag-region className="h-11 flex-none" />
        <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <h1 className="mb-2 text-lg font-semibold text-tx">ScreenForge</h1>
          <p className="mb-6 text-sm text-tx2">
            Pick the project folder. The canvas is saved in its <code>.screenforge/</code> folder.
          </p>
          <button
            onClick={openFolder}
            className="rounded-md bg-acc px-4 py-2 text-sm font-medium text-acc-tx hover:opacity-90"
          >
            Open a folder
          </button>
        </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex h-screen w-screen flex-col overflow-hidden bg-bg">
      <TitleBar
        folder={folderName(project.root)}
        path={project.root}
        onChangeFolder={openFolder}
        saved={saved}
        agent={agentState && agentPill(agentState)}
        onAgent={openAgents}
        exportLabel={exportLabel}
        onExport={() => canvasControls.current?.exportPng()}
      />
      <CanvasView
        key={project.root}
        root={project.root}
        onSaved={setSaved}
        onExportLabel={setExportLabel}
        controls={canvasControls}
      />
      {agents && (
        <AgentSetup
          status={agents}
          messages={agentMessages}
          busy={agentBusy}
          onConfigure={configure}
          onClose={() => setAgents(null)}
        />
      )}
    </main>
  );
}
