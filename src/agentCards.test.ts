import { describe, expect, it } from "vitest";
import type { ClientStatus } from "./AgentSetup";
import { cardView } from "./agentCards";

const BIN = "/Applications/ScreenForge.app/Contents/MacOS/screenforge-mcp";
const view = (client: Partial<ClientStatus>, extra: Partial<Parameters<typeof cardView>[0]> = {}) =>
  cardView({
    id: "claude_code",
    client: { available: true, registered: null, ...client },
    binary: BIN,
    busy: false,
    anyBusy: false,
    result: undefined,
    ...extra,
  });

describe("cardView", () => {
  it("offers Connect, as the main action, to a client that is not registered", () => {
    expect(view({})).toMatchObject({ state: "off", status: "Not connected", button: "Connect", primary: true, disabled: false });
    expect(view({}).message).toBeUndefined();
  });

  it("shows a client registered with this app's server as connected, with Reconnect as a quiet action", () => {
    expect(view({ registered: BIN })).toMatchObject({ state: "on", status: "Connected", tone: "ok", button: "Reconnect", primary: false });
    expect(view({ registered: BIN }).message).toBeUndefined();
  });

  it("tells what to do right after connecting: restart the client", () => {
    expect(view({ registered: BIN }, { result: { connected: true } }).message).toEqual({
      text: "Connected for every project. Restart running Claude Code sessions to use it.",
      tone: "ok",
    });
    expect(view({ registered: BIN }, { id: "claude_desktop", result: { connected: true } }).message?.text).toBe(
      "Connected. Quit and reopen Claude Desktop to load it.",
    );
  });

  it("flags a registration that points to another server, and offers Update", () => {
    expect(view({ registered: "/old/screenforge-mcp" })).toMatchObject({
      state: "other",
      status: "Points to another server",
      tone: "warn",
      button: "Update",
      primary: true,
      message: { text: "Registered to another ScreenForge server. Update to point it at this project.", tone: "warn" },
    });
  });

  it("disables a client that is not installed and says why", () => {
    expect(view({ available: false }, { id: "claude_desktop" })).toMatchObject({
      state: "none",
      status: "Not installed",
      disabled: true,
      message: { text: "Claude Desktop isn’t installed on this Mac.", tone: "muted" },
    });
    expect(view({ available: false }).message?.text).toBe("The `claude` command was not found on this Mac.");
  });

  it("shows Connecting… while this client is being configured", () => {
    expect(view({}, { busy: true, anyBusy: true })).toMatchObject({ state: "busy", status: "Connecting…", tone: "accent", button: "Connecting…", disabled: true });
  });

  it("disables the other clients' buttons while one is being configured", () => {
    expect(view({}, { anyBusy: true }).disabled).toBe(true);
  });

  it("shows a failed attempt with its reason and a Retry", () => {
    expect(view({}, { result: { error: "permission denied" } })).toMatchObject({
      state: "fail",
      status: "Connection failed",
      tone: "warn",
      button: "Retry",
      primary: true,
      message: { text: "Couldn’t connect: permission denied", tone: "warn" },
    });
  });

  it("cannot connect anything without the MCP server binary", () => {
    expect(view({}, { binary: null }).disabled).toBe(true);
    expect(view({ registered: BIN }, { binary: null }).disabled).toBe(true);
  });
});
