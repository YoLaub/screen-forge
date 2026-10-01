import { invoke } from "@tauri-apps/api/core";
import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { AgentRead } from "../agentRead";
import type { AgentClient, AgentStatus } from "../AgentSetup";
import type { ExportFormat, ExportSettings } from "../canvas/exportOptions";
import type { NodeRecord } from "../canvas/nodeRecord";
import type { WindowInfo } from "../canvas/WindowPicker";

/** A node as sent to the `save_canvas` command. */
export interface NodeExportDto {
  node: NodeRecord;
  svg: string | null;
  png_base64: string | null;
}

export function getLastProject(): Promise<string | null> {
  return invoke("get_last_project");
}

export function setLastProject(root: string): Promise<void> {
  return invoke("set_last_project", { root });
}

export async function pickFolder(): Promise<string | null> {
  const picked = await open({ directory: true, multiple: false, title: "Open a project folder" });
  return typeof picked === "string" ? picked : null;
}

const FORMAT_NAME: Record<ExportFormat, string> = { png: "PNG", jpg: "JPG", webp: "WebP" };

/** Path chosen in the "Save as" dialog for an image export, null when cancelled. */
export function pickImagePath(fileName: string, format: ExportFormat): Promise<string | null> {
  return save({
    defaultPath: fileName,
    filters: [{ name: `${FORMAT_NAME[format]} image`, extensions: [format] }],
    title: `Export as ${FORMAT_NAME[format]}`,
  });
}

/** Saves `pngBase64` (what the canvas rendered) at `path`, converted to the chosen format. */
export function exportImage(path: string, pngBase64: string, { format, quality }: ExportSettings): Promise<void> {
  return invoke("export_image", { path, pngBase64, format, quality });
}

/** The latest read of the canvas by an agent, null when none was recorded. */
export function lastAgentRead(root: string): Promise<AgentRead | null> {
  return invoke("last_agent_read", { root });
}

/** A recently opened project, as the home screen lists it. */
export interface RecentProject {
  path: string;
  /** The folder's own name. */
  name: string;
  /** The path with the home folder written `~`. */
  display: string;
  opened_ms: number;
}

/** Recently opened projects, newest first. */
export function recentProjects(): Promise<RecentProject[]> {
  return invoke("recent_projects");
}

export function loadCanvas(root: string): Promise<string | null> {
  return invoke("load_canvas", { root });
}

/** `canvasPngBase64` is the whole-canvas render, null when the canvas is empty. */
export function saveCanvas(
  root: string,
  canvasJson: string,
  canvasPngBase64: string | null,
  nodes: NodeExportDto[],
): Promise<void> {
  return invoke("save_canvas", { root, canvasJson, canvasPngBase64, nodes });
}

export function listWindows(): Promise<WindowInfo[]> {
  return invoke("list_windows");
}

/** Base64 PNG of window `id`. */
export function captureWindow(id: number): Promise<string> {
  return invoke("capture_window", { id });
}

/** A capture made with the Cmd+Shift+X global shortcut. */
export interface ShortcutCapture {
  window: WindowInfo;
  png_base64: string;
}

/** Cmd+Shift+X captured the window in front, or failed with a message. */
export async function onShortcutCapture(
  onCapture: (capture: ShortcutCapture) => void,
  onFailure: (message: string) => void,
): Promise<UnlistenFn> {
  const unlistenCapture = await listen<ShortcutCapture>("shortcut-capture", (e) => onCapture(e.payload));
  const unlistenFailure = await listen<string>("shortcut-capture-failed", (e) => onFailure(e.payload));
  return () => {
    unlistenCapture();
    unlistenFailure();
  };
}

/** False when macOS Screen Recording is not granted (first call shows the OS prompt). */
export function ensureScreenCaptureAccess(): Promise<boolean> {
  return invoke("ensure_screen_capture_access");
}

export function openScreenCaptureSettings(): Promise<void> {
  return invoke("open_screen_capture_settings");
}

export function agentStatus(): Promise<AgentStatus> {
  return invoke("agent_status");
}

export function configureAgent(client: AgentClient): Promise<void> {
  return invoke(client === "claude_code" ? "configure_claude_code" : "configure_claude_desktop");
}

/** The edge pill, a second small window docked to the right of the screen. */
export type PillMode = "collapsed" | "expanded" | "captured" | "picking";

export function pillSetState(state: PillMode): Promise<void> {
  return invoke("pill_set_state", { state });
}

/** Moves the pill `top` logical pixels below the top of its screen. */
export function pillSetTop(state: PillMode, top: number): Promise<void> {
  return invoke("pill_set_top", { state, top });
}

export function showMainWindow(): Promise<void> {
  return invoke("show_main_window");
}

/** Captures the window in front; the result arrives as a `shortcut-capture` event. */
export function captureFront(): Promise<void> {
  return invoke("capture_front");
}

/** Captures window `id`; the result arrives as a `shortcut-capture` event, like `captureFront`. */
export function captureChosen(id: number): Promise<void> {
  return invoke("capture_chosen", { id });
}

/** The capture card of the pill tells the canvas what to do with the capture just made. */
export type PillRequest =
  | { kind: "paste" }
  | { kind: "undo" }
  /** The pill just opened and wants the canvas summary. */
  | { kind: "hello" }
  | { kind: "instructions"; text: string };

export function sendPillRequest(request: PillRequest): Promise<void> {
  return emit("pill-request", request);
}

export function onPillRequest(handler: (request: PillRequest) => void): Promise<UnlistenFn> {
  return listen<PillRequest>("pill-request", (e) => handler(e.payload));
}

/** How many elements carry instructions: the canvas tells the pill after every change. */
export function sendCanvasSummary(instructions: number): Promise<void> {
  return emit("canvas-summary", { instructions });
}

export function onCanvasSummary(handler: (instructions: number) => void): Promise<UnlistenFn> {
  return listen<{ instructions: number }>("canvas-summary", (e) => handler(e.payload.instructions));
}

/** A capture that failed in the main window (Cmd+Shift+X or the pill's button). */
export function onCaptureFailed(handler: (message: string) => void): Promise<UnlistenFn> {
  return listen<string>("shortcut-capture-failed", (e) => handler(e.payload));
}

/** A capture made while the pill is on screen, for its card. */
export function onCaptured(handler: (capture: ShortcutCapture) => void): Promise<UnlistenFn> {
  return listen<ShortcutCapture>("shortcut-capture", (e) => handler(e.payload));
}
