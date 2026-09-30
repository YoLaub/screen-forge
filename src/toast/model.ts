/**
 * Toasts replace the grey status line (mockup): a warning for failures and gestures
 * that did nothing, a green confirmation (not in the mockup) for completed actions.
 */
export type ToastKind = "warn" | "ok";

export interface ToastSpec {
  kind: ToastKind;
  title: string;
  message?: string;
  /** Stays until dismissed (a failure that will not go away by itself). */
  sticky?: boolean;
}

export interface Toast extends ToastSpec {
  id: number;
}

export const MAX_TOASTS = 3;
/** How long each kind stays on screen, in milliseconds. */
export const TOAST_MS = { ok: 4000, warn: 8000 } as const;

/** Warning for a failed action: `title` names the action, the message is the reason. */
export function failureToast(title: string, error: unknown, sticky = false): ToastSpec {
  const reason = (error instanceof Error ? error.message : String(error)).replace(/^Error:\s*/, "");
  return { kind: "warn", title, message: reason, ...(sticky && { sticky }) };
}

/**
 * `spec` added last. An identical toast (same kind, title and message) is replaced
 * rather than stacked, so a failing autosave shows one toast, not one per retry.
 */
export function pushToast(list: Toast[], spec: ToastSpec, id: number): Toast[] {
  const others = list.filter((t) => !(t.kind === spec.kind && t.title === spec.title && t.message === spec.message));
  return [...others, { ...spec, id }].slice(-MAX_TOASTS);
}

export function dismissToast(list: Toast[], id: number): Toast[] {
  return list.filter((t) => t.id !== id);
}
