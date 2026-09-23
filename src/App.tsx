import { useEffect, useState } from "react";
import CanvasView from "./canvas/CanvasView";
import { getLastProject, pickFolder, setLastProject } from "./services/backend";

type ProjectState = { status: "loading" } | { status: "none" } | { status: "open"; root: string };

function folderName(root: string): string {
  return root.split("/").filter(Boolean).pop() ?? root;
}

export default function App() {
  const [project, setProject] = useState<ProjectState>({ status: "loading" });

  useEffect(() => {
    getLastProject().then((root) =>
      setProject(root ? { status: "open", root } : { status: "none" }),
    );
  }, []);

  async function openFolder() {
    const root = await pickFolder();
    if (!root) return;
    await setLastProject(root);
    setProject({ status: "open", root });
  }

  if (project.status === "loading") return null;

  if (project.status === "none") {
    return (
      <main className="flex h-screen w-screen items-center justify-center bg-neutral-100">
        <div className="text-center">
          <h1 className="mb-2 text-lg font-semibold text-neutral-800">ScreenForge</h1>
          <p className="mb-6 text-sm text-neutral-500">
            Pick the project folder. The canvas is saved in its <code>.screenforge/</code> folder.
          </p>
          <button
            onClick={openFolder}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
          >
            Open a folder
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden bg-neutral-100">
      <header className="flex items-center gap-3 border-b border-neutral-200 bg-white px-3 py-2 text-sm">
        <span className="font-medium text-neutral-800" title={project.root}>
          {folderName(project.root)}
        </span>
        <button onClick={openFolder} className="text-neutral-500 hover:text-neutral-900">
          Change folder
        </button>
      </header>
      <CanvasView key={project.root} root={project.root} />
    </main>
  );
}
