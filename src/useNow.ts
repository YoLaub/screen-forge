import { useEffect, useState } from "react";

/** The current time in milliseconds, renewed every `everyMs`, so "5 min ago" keeps moving on its own. */
export function useNow(everyMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}
