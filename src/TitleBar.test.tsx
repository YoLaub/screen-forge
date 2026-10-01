import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentRead } from "./agentRead";
import type { AgentStatus } from "./AgentSetup";
import type { ExportSettings } from "./canvas/exportOptions";
import TitleBar from "./TitleBar";

const NOW = new Date(2026, 9, 1, 14, 10).getTime();
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

const status: AgentStatus = {
  mcp_binary: { Ok: "/app/screenforge-mcp" },
  claude_code: { available: true, registered: "/app/screenforge-mcp" },
  claude_desktop: { available: false, registered: null },
};
const read = (at_ms: number): AgentRead => ({ at_ms, tool: "get_canvas_snapshot", client: "claude-code", nodes: 8, with_instructions: 4 });

function setup(lastRead: AgentRead | null) {
  render(
    <TitleBar
      folder="acme-dashboard"
      path="/dev/acme-dashboard"
      onChangeFolder={() => {}}
      saved={null}
      agentStatus={status}
      lastRead={lastRead}
      onAgent={() => {}}
      exportLabel="Export canvas"
      onExport={() => {}}
      exportSettings={{ format: "png", quality: "high" }}
      onExportSettings={() => {}}
    />,
  );
}

function setupExport(settings: ExportSettings) {
  const onExportSettings = vi.fn();
  render(
    <TitleBar
      folder="p"
      path="/p"
      onChangeFolder={() => {}}
      saved={null}
      agentStatus={status}
      lastRead={null}
      onAgent={() => {}}
      exportLabel="Export canvas"
      onExport={() => {}}
      exportSettings={settings}
      onExportSettings={onExportSettings}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Export options" }));
  return onExportSettings;
}

describe("TitleBar export options", () => {
  it("offers PNG, JPG and WebP, the current one pressed", () => {
    setupExport({ format: "webp", quality: "high" });
    expect(screen.getByRole("button", { name: "PNG" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "JPG" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "WebP" })).toHaveAttribute("aria-pressed", "true");
  });

  it("changes the format and keeps the quality", () => {
    const onChange = setupExport({ format: "png", quality: "medium" });
    fireEvent.click(screen.getByRole("button", { name: "JPG" }));
    expect(onChange).toHaveBeenCalledWith({ format: "jpg", quality: "medium" });
  });

  it("changes the quality of a lossy format", () => {
    const onChange = setupExport({ format: "jpg", quality: "high" });
    fireEvent.click(screen.getByRole("button", { name: "Low" }));
    expect(onChange).toHaveBeenCalledWith({ format: "jpg", quality: "low" });
  });

  it("says PNG is lossless and leaves its quality alone", () => {
    setupExport({ format: "png", quality: "high" });
    expect(screen.getByText("PNG keeps every pixel: quality applies to JPG and WebP.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Low" })).toBeDisabled();
  });

  it("closes on Escape", () => {
    setupExport({ format: "png", quality: "high" });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "JPG" })).toBeNull();
  });
});

describe("TitleBar agent pill", () => {
  it("says connected until an agent has read the canvas", () => {
    setup(null);
    expect(screen.getByRole("button", { name: "Claude Code connected" })).toBeInTheDocument();
  });

  it("says when the canvas was read", () => {
    setup(read(NOW - 10_000));
    expect(screen.getByRole("button", { name: "Claude Code read the canvas · just now" })).toBeInTheDocument();
  });

  it("moves on by itself: just now becomes minutes ago without anything else happening", () => {
    setup(read(NOW - 10_000));
    act(() => vi.advanceTimersByTime(5 * 60_000));
    expect(screen.getByRole("button", { name: "Claude Code read the canvas · 5 min ago" })).toBeInTheDocument();
  });

  it("offers Connect AI when no agent points at this server", () => {
    render(
      <TitleBar
        folder="acme-dashboard"
        path="/x"
        onChangeFolder={() => {}}
        saved={null}
        agentStatus={{ ...status, claude_code: { available: true, registered: null } }}
        lastRead={read(NOW)}
        onAgent={() => {}}
        exportLabel={null}
        onExport={() => {}}
        exportSettings={{ format: "png", quality: "high" }}
        onExportSettings={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Connect AI" })).toBeInTheDocument();
  });
});
