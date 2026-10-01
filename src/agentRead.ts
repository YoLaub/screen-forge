/** The latest read of the canvas by an agent, as recorded by `screenforge-mcp`. */
export interface AgentRead {
  /** Unix time in milliseconds. */
  at_ms: number;
  tool: string;
  /** The agent, as its MCP client names itself. */
  client?: string;
  nodes: number;
  with_instructions: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MINUTE = 60_000;

const two = (n: number) => String(n).padStart(2, "0");
const clock = (d: Date) => `${two(d.getHours())}:${two(d.getMinutes())}`;
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Whole days from `at` to `now`, by calendar day (0 = same day, 1 = yesterday). */
function daysAgo(at: Date, now: Date): number {
  return Math.round((dayStart(now) - dayStart(at)) / 86_400_000);
}

/** "Claude Code", "Claude Desktop", the client's own name, or "An agent" when it gave none. */
export function clientLabel(client?: string | null): string {
  const name = (client ?? "").trim();
  if (!name) return "An agent";
  const lower = name.toLowerCase();
  if (lower.includes("claude") && lower.includes("code")) return "Claude Code";
  if (lower.includes("claude")) return "Claude Desktop";
  return name;
}

/** When, for the title bar: "just now", "5 min ago", "09:05", "yesterday" or "28 Sep". */
export function agoLabel(atMs: number, nowMs: number): string {
  const age = nowMs - atMs;
  if (age < 45_000) return "just now";
  if (age < 60 * MINUTE) return `${Math.max(1, Math.round(age / MINUTE))} min ago`;
  const at = new Date(atMs);
  const days = daysAgo(at, new Date(nowMs));
  if (days <= 0) return clock(at);
  if (days === 1) return "yesterday";
  return `${at.getDate()} ${MONTHS[at.getMonth()]}`;
}

/** The Connect AI footer: who read, when, and how much. */
export function lastReadLine(read: AgentRead, nowMs: number): string {
  const at = new Date(read.at_ms);
  const days = daysAgo(at, new Date(nowMs));
  const when =
    days <= 0 ? `at ${clock(at)}` : days === 1 ? `yesterday at ${clock(at)}` : `on ${at.getDate()} ${MONTHS[at.getMonth()]} at ${clock(at)}`;
  const elements = `${read.nodes} ${read.nodes === 1 ? "element" : "elements"}`;
  return `${clientLabel(read.client)} last read the canvas ${when} · ${elements}, ${read.with_instructions} with instructions`;
}
