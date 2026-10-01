import { useEffect, useRef, useState } from "react";
import type { ClientResult } from "./agentCards";
import AgentSetup, { type AgentClient, type AgentStatus } from "./AgentSetup";
import CanvasView, { type CanvasControls } from "./canvas/CanvasView";
import Home from "./Home";
import TitleBar from "./TitleBar";
import { lastReadLine } from "./agentRead";
import { useLastRead } from "./useLastRead";
import {
  agentStatus,
  configureAgent,
  getLastProject,
  pickFolder,
  setLastProject,
} from "./services/backend";

type ProjectState = { status: "loading" } | { status: "none" } | { status: "open"; root: string };

function folderName(root: string): string {
  return root.split("/").filter(Boolean).pop() ?? root;
}

export default function App() {
  const [project, setProject] = useState<ProjectState>({ status: "loading" });
  const [agents, setAgents] = useState<AgentStatus | null>(null);
  const [agentBusy, setAgentBusy] = useState<AgentClient | null>(null);
  const [agentResults, setAgentResults] = useState<Partial<Record<AgentClient, ClientResult>>>({});
  // The title bar shows the agent state without opening the dialog.
  const [agentState, setAgentState] = useState<AgentStatus | null>(null);
  const [saved, setSaved] = useState<Date | null>(null);
  const lastRead = useLastRead(project.status === "open" ? project.root : null);
  // The canvas loads behind the home screen's "Opening…" card and is revealed once it has.
  const [loaded, setLoaded] = useState(false);
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
    setLoaded(false);
    setProject({ status: "open", root });
  }

  async function openAgents() {
    setAgentResults({});
    setAgents(await refreshAgents());
  }

  async function configure(client: AgentClient) {
    setAgentBusy(client);
    try {
      await configureAgent(client);
      setAgentResults((r) => ({ ...r, [client]: { connected: true } }));
    } catch (error) {
      setAgentResults((r) => ({ ...r, [client]: { error: String(error) } }));
    } finally {
      setAgentBusy(null);
      setAgents(await refreshAgents());
    }
  }

  // Cmd+O opens the folder picker from the home screen and from the workspace.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        openFolder();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (project.status === "loading") return null;

  if (project.status === "none") {
    return (
      <main className="h-screen w-screen">
        <Home onOpen={openFolder} />
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
        agentStatus={agentState}
        lastRead={lastRead}
        onAgent={openAgents}
        exportLabel={exportLabel}
        onExport={() => canvasControls.current?.exportPng()}
      />
      <CanvasView
        key={project.root}
        root={project.root}
        onLoaded={() => setLoaded(true)}
        onSaved={setSaved}
        onExportLabel={setExportLabel}
        controls={canvasControls}
      />
      {!loaded && (
        <div className="absolute inset-0 z-40">
          <Home opening={folderName(project.root)} onOpen={openFolder} />
        </div>
      )}
      {agents && (
        <AgentSetup
          status={agents}
          project={{ name: folderName(project.root), path: project.root }}
          results={agentResults}
          lastRead={lastRead && lastReadLine(lastRead, Date.now())}
          busy={agentBusy}
          onConfigure={configure}
          onClose={() => setAgents(null)}
        />
      )}
    </main>
  );
}
