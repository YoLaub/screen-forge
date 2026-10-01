import { describe, expect, it } from "vitest";
import { type AgentRead, agoLabel, clientLabel, lastReadLine } from "./agentRead";

const at = (y: number, mo: number, d: number, h: number, mi: number, s = 0) => new Date(y, mo - 1, d, h, mi, s).getTime();
const NOW = at(2026, 10, 1, 14, 10);

const read = (when: number, extra: Partial<AgentRead> = {}): AgentRead => ({
  at_ms: when,
  tool: "get_canvas_snapshot",
  client: "claude-code",
  nodes: 8,
  with_instructions: 4,
  ...extra,
});

describe("clientLabel", () => {
  it("names the Claude clients, whatever way their MCP client spells itself", () => {
    expect(clientLabel("claude-code")).toBe("Claude Code");
    expect(clientLabel("Claude Code")).toBe("Claude Code");
    expect(clientLabel("claude-ai")).toBe("Claude Desktop");
    expect(clientLabel("Claude Desktop")).toBe("Claude Desktop");
  });

  it("keeps another agent's own name, and says 'An agent' when it gave none", () => {
    expect(clientLabel("cursor-vscode")).toBe("cursor-vscode");
    expect(clientLabel(undefined)).toBe("An agent");
    expect(clientLabel("  ")).toBe("An agent");
    expect(clientLabel(null)).toBe("An agent");
  });
});

describe("agoLabel", () => {
  it("says just now for the first moments, and a clock skew does not go negative", () => {
    expect(agoLabel(NOW - 10_000, NOW)).toBe("just now");
    expect(agoLabel(NOW + 5_000, NOW)).toBe("just now");
  });

  it("counts minutes within the hour", () => {
    expect(agoLabel(NOW - 60_000, NOW)).toBe("1 min ago");
    expect(agoLabel(NOW - 5 * 60_000, NOW)).toBe("5 min ago");
    expect(agoLabel(NOW - 59 * 60_000, NOW)).toBe("59 min ago");
  });

  it("shows the time later the same day, then yesterday, then the date", () => {
    expect(agoLabel(at(2026, 10, 1, 9, 5), NOW)).toBe("09:05");
    expect(agoLabel(at(2026, 9, 30, 23, 50), NOW)).toBe("yesterday");
    expect(agoLabel(at(2026, 9, 28, 14, 5), NOW)).toBe("28 Sep");
  });
});

describe("lastReadLine", () => {
  it("tells who read, when and how much, in the mockup's words", () => {
    expect(lastReadLine(read(at(2026, 10, 1, 14, 5)), NOW)).toBe(
      "Claude Code last read the canvas at 14:05 · 8 elements, 4 with instructions",
    );
  });

  it("dates a read from another day", () => {
    expect(lastReadLine(read(at(2026, 9, 30, 9, 1)), NOW)).toContain("last read the canvas yesterday at 09:01");
    expect(lastReadLine(read(at(2026, 9, 28, 16, 30)), NOW)).toContain("last read the canvas on 28 Sep at 16:30");
  });

  it("uses singular for one element and 'An agent' when the client is unknown", () => {
    expect(lastReadLine(read(at(2026, 10, 1, 14, 5), { client: undefined, nodes: 1, with_instructions: 0 }), NOW)).toBe(
      "An agent last read the canvas at 14:05 · 1 element, 0 with instructions",
    );
  });
});
