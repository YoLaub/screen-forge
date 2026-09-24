import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
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
