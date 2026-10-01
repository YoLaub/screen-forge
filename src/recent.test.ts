import { describe, expect, it } from "vitest";
import { SHOWN_RECENT, shownRecent } from "./recent";
import type { RecentProject } from "./services/backend";

const project = (n: number): RecentProject => ({ path: `/dev/p${n}`, name: `p${n}`, display: `~/dev/p${n}`, opened_ms: n });

describe("shownRecent", () => {
  it("shows the first few, which are the newest", () => {
    const all = Array.from({ length: 10 }, (_, i) => project(10 - i));
    expect(shownRecent(all)).toHaveLength(SHOWN_RECENT);
    expect(shownRecent(all)[0]).toEqual(project(10));
  });

  it("shows everything when there are few", () => {
    expect(shownRecent([project(1)])).toEqual([project(1)]);
    expect(shownRecent([])).toEqual([]);
  });
});
