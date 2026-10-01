import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "./Home";
import type { RecentProject } from "./services/backend";

describe("Home", () => {
  it("presents the app and says where the canvas is saved", () => {
    render(<Home onOpen={() => {}} />);
    expect(screen.getByRole("heading", { name: "ScreenForge" })).toBeInTheDocument();
    expect(screen.getByText(/Pick the project folder\. The canvas is saved in its/)).toHaveTextContent(".screenforge/");
  });

  it("opens the folder picker from the Open a folder card, which shows its shortcut", () => {
    const onOpen = vi.fn();
    render(<Home onOpen={onOpen} />);
    const card = screen.getByRole("button", { name: "Open a folder" });
    expect(card).toHaveTextContent("⌘O");
    fireEvent.click(card);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("shows the project being opened instead of the card", () => {
    render(<Home opening="acme-dashboard" onOpen={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent("Opening acme-dashboard…");
    expect(screen.getByRole("status")).toHaveTextContent("Loading the canvas from .screenforge/");
    expect(screen.queryByRole("button", { name: "Open a folder" })).not.toBeInTheDocument();
  });
});

describe("Home recent projects", () => {
  const day = (offset: number) => new Date(2026, 9, 1 - offset, 10).getTime();
  const recent: RecentProject[] = [
    { path: "/Users/me/dev/acme-dashboard", name: "acme-dashboard", display: "~/dev/acme-dashboard", opened_ms: Date.now() - 1000 },
    { path: "/Users/me/dev/work/billing-api", name: "billing-api", display: "~/dev/work/billing-api", opened_ms: Date.now() - 86_400_000 },
  ];

  it("lists them with name, path and when", () => {
    render(<Home recent={recent} onOpen={() => {}} onOpenRecent={() => {}} />);
    expect(screen.getByText("Recent")).toBeInTheDocument();
    const row = screen.getByRole("button", { name: /acme-dashboard/ });
    expect(row).toHaveTextContent("~/dev/acme-dashboard");
    expect(row).toHaveTextContent("Today");
    expect(screen.getByRole("button", { name: /billing-api/ })).toHaveTextContent("Yesterday");
  });

  it("opens a project on click, by its full path", () => {
    const onOpenRecent = vi.fn();
    render(<Home recent={recent} onOpen={() => {}} onOpenRecent={onOpenRecent} />);
    fireEvent.click(screen.getByRole("button", { name: /billing-api/ }));
    expect(onOpenRecent).toHaveBeenCalledWith("/Users/me/dev/work/billing-api");
  });

  it("shows no Recent section until there is something to list", () => {
    render(<Home recent={[]} onOpen={() => {}} onOpenRecent={() => {}} />);
    expect(screen.queryByText("Recent")).not.toBeInTheDocument();
  });

  it("lists only the newest few", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ path: `/p${i}`, name: `project-${i}`, display: `~/p${i}`, opened_ms: day(0) - i }));
    render(<Home recent={many} onOpen={() => {}} onOpenRecent={() => {}} />);
    expect(screen.getAllByRole("button", { name: /project-/ })).toHaveLength(5);
    expect(screen.getByRole("button", { name: /project-0/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /project-5/ })).not.toBeInTheDocument();
  });

  it("keeps the list but stops it from being clicked while a project is opening", () => {
    const onOpenRecent = vi.fn();
    render(<Home opening="acme-dashboard" recent={recent} onOpen={() => {}} onOpenRecent={onOpenRecent} />);
    const row = screen.getByRole("button", { name: /billing-api/ });
    expect(row).toBeDisabled();
    fireEvent.click(row);
    expect(onOpenRecent).not.toHaveBeenCalled();
  });
});
