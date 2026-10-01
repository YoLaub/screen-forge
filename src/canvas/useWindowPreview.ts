import { useEffect, useRef, useState } from "react";

export type Preview = { status: "idle" } | { status: "loading" } | { status: "ready"; png: string } | { status: "failed" };

/** Captures kept while the picker is open: enough to go back and forth, bounded in memory. */
export const PREVIEW_CACHE = 6;

/**
 * Preview (base64 PNG) of window `id`. The capture starts once the window has been the
 * active one for `delay` ms, so moving through the list does not capture every row;
 * a capture that finishes after the user moved on is kept for later but not shown.
 */
export function useWindowPreview(id: number | null, capture: (id: number) => Promise<string>, delay = 250): Preview {
  const cache = useRef(new Map<number, string>());
  const [preview, setPreview] = useState<Preview>({ status: "idle" });

  useEffect(() => {
    if (id === null) {
      setPreview({ status: "idle" });
      return;
    }
    const cached = cache.current.get(id);
    if (cached !== undefined) {
      setPreview({ status: "ready", png: cached });
      return;
    }
    setPreview({ status: "loading" });
    let stale = false;
    const timer = setTimeout(() => {
      capture(id).then(
        (png) => {
          cache.current.set(id, png);
          if (cache.current.size > PREVIEW_CACHE) cache.current.delete(cache.current.keys().next().value!);
          if (!stale) setPreview({ status: "ready", png });
        },
        () => !stale && setPreview({ status: "failed" }),
      );
    }, delay);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [id, capture, delay]);

  return preview;
}
