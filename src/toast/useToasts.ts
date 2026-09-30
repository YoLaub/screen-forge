import { useCallback, useEffect, useRef, useState } from "react";
import { type Toast, type ToastSpec, TOAST_MS, dismissToast, pushToast } from "./model";

/**
 * Toast list with automatic dismissal. `push` and `dismiss` keep their identity
 * across renders, so long-lived handlers (canvas events) can hold on to them.
 */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const push = useCallback((spec: ToastSpec) => {
    const id = nextId.current++;
    setToasts((list) => pushToast(list, spec, id));
  }, []);
  const dismiss = useCallback((id: number) => setToasts((list) => dismissToast(list, id)), []);

  // One timer per visible toast; a replaced or dismissed toast loses its timer.
  useEffect(() => {
    for (const toast of toasts) {
      if (toast.sticky || timers.current.has(toast.id)) continue;
      timers.current.set(toast.id, setTimeout(() => dismiss(toast.id), TOAST_MS[toast.kind]));
    }
    for (const [id, timer] of timers.current) {
      if (toasts.some((t) => t.id === id)) continue;
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, [toasts, dismiss]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return { toasts, push, dismiss };
}
