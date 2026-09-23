import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { NodeRecord } from "../canvas/nodeRecord";

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

export function saveCanvas(root: string, canvasJson: string, nodes: NodeExportDto[]): Promise<void> {
  return invoke("save_canvas", { root, canvasJson, nodes });
}
