import type { RecentProject } from "./services/backend";

/** How many recent projects the home screen lists (more are remembered). */
export const SHOWN_RECENT = 5;

/** The projects the home screen lists: the newest few. */
export function shownRecent(recent: RecentProject[]): RecentProject[] {
  return recent.slice(0, SHOWN_RECENT);
}
