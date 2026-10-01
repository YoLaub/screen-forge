import { describe, expect, it } from "vitest";
import { agentTooltip, captureLines, nextMode, shouldAutoDismiss } from "./pillState";

describe("nextMode", () => {
  it("opens on hover and closes when the pointer leaves", () => {
    expect(nextMode("collapsed", "enter")).toBe("expanded");
    expect(nextMode("expanded", "leave")).toBe("collapsed");
  });

  it("stays on the capture card while the pointer comes and goes", () => {
    expect(nextMode("captured", "enter")).toBe("captured");
    expect(nextMode("captured", "leave")).toBe("captured");
  });

  it("shows the card after a capture, whatever the pill was doing", () => {
    expect(nextMode("collapsed", "captured")).toBe("captured");
    expect(nextMode("expanded", "captured")).toBe("captured");
  });

  it("goes back to the tab when the card is dismissed", () => {
    expect(nextMode("captured", "dismiss")).toBe("collapsed");
  });

  it("ignores a dismiss when there is no card", () => {
    expect(nextMode("expanded", "dismiss")).toBe("expanded");
  });
});

describe("nextMode, window list", () => {
  it("opens the window list from the action bar and stays on it while the pointer leaves", () => {
    expect(nextMode("expanded", "pick")).toBe("picking");
    expect(nextMode("picking", "leave")).toBe("picking");
    expect(nextMode("picking", "enter")).toBe("picking");
  });

  it("closes the list on dismiss and shows the card once a window is captured", () => {
    expect(nextMode("picking", "dismiss")).toBe("collapsed");
    expect(nextMode("picking", "captured")).toBe("captured");
  });
});

describe("agentTooltip", () => {
  it("says who is connected and how many elements carry instructions", () => {
    expect(agentTooltip({ connected: true, client: "Claude Code" }, 4)).toBe(
      "Claude Code connected · 4 instructions on canvas",
    );
  });

  it("uses the singular for one instruction", () => {
    expect(agentTooltip({ connected: true, client: "Claude Code" }, 1)).toBe(
      "Claude Code connected · 1 instruction on canvas",
    );
  });

  it("says no agent is connected, and leaves the count out when unknown", () => {
    expect(agentTooltip({ connected: false }, null)).toBe("No agent connected");
    expect(agentTooltip({ connected: true, client: "Claude Desktop" }, null)).toBe("Claude Desktop connected");
  });
});

describe("captureLines", () => {
  it("names the app and the window", () => {
    expect(captureLines({ id: 1, app_name: "Safari", title: "localhost:5173/login", width: 1, height: 1 })).toBe(
      "Safari — localhost:5173/login",
    );
  });

  it("leaves the dash out of an untitled window", () => {
    expect(captureLines({ id: 1, app_name: "Finder", title: "", width: 1, height: 1 })).toBe("Finder");
  });
});

describe("shouldAutoDismiss", () => {
  it("lets an untouched card go", () => {
    expect(shouldAutoDismiss({ text: "", hovered: false, focused: false })).toBe(true);
  });

  it("keeps the card while it is being used or has text", () => {
    expect(shouldAutoDismiss({ text: "", hovered: true, focused: false })).toBe(false);
    expect(shouldAutoDismiss({ text: "", hovered: false, focused: true })).toBe(false);
    expect(shouldAutoDismiss({ text: "fix this", hovered: false, focused: false })).toBe(false);
  });
});
