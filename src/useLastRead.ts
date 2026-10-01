import { useEffect, useState } from "react";
import type { AgentRead } from "./agentRead";
import { lastAgentRead } from "./services/backend";

/** How often the app looks for a read made by an agent in another window. */
const POLL_MS = 3000;

const same = (a: AgentRead | null, b: AgentRead | null) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The latest read of project `root`'s canvas by an agent. The agent runs in another
 * process, so the app looks at the small file `screenforge-mcp` leaves: every few seconds,
 * and as soon as the window gets the focus back. The same object is returned while
 * nothing changed.
 */
export function useLastRead(root: string | null, fetchRead: (root: string) => Promise<AgentRead | null> = lastAgentRead): AgentRead | null {
  const [read, setRead] = useState<AgentRead | null>(null);

  useEffect(() => {
    if (!root) {
      setRead(null);
      return;
    }
    let stale = false;
    const refresh = () => {
      // A hidden window has nobody to show it to.
      if (document.hidden) return;
      fetchRead(root).then(
        (next) => {
          if (!stale) setRead((previous) => (same(previous, next) ? previous : next));
        },
        () => {
          // Keep what is shown: a missed refresh is not worth an error.
        },
      );
    };
    setRead(null);
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    window.addEventListener("focus", refresh);
    return () => {
      stale = true;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [root, fetchRead]);

  return read;
}
