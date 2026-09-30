import type { ReactNode } from "react";
import type { Tool } from "./tools";

/** 16 px stroke icons from the mockup (SF Workspace.dc.html), drawn in currentColor. */
const svg = (children: ReactNode, strokeWidth = 1.5, extra: object = {}) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={strokeWidth} {...extra}>
    {children}
  </svg>
);

export const TOOL_ICONS: Record<Tool, ReactNode> = {
  select: svg(<path d="M4 2.5l8.5 5.2-3.9 1L6.8 12.5z" />, 1.5, { strokeLinejoin: "round" }),
  frame: svg(<path d="M5 2v12M11 2v12M2 5h12M2 11h12" />),
  rect: svg(<rect x="2.5" y="3.5" width="11" height="9" rx="1.5" />),
  ellipse: svg(<circle cx="8" cy="8" r="5.5" />),
  polygon: svg(<path d="M8 2.5l5.5 4-2 6.5h-7l-2-6.5z" />, 1.5, { strokeLinejoin: "round" }),
  line: svg(<path d="M3 13L13 3" />, 1.5, { strokeLinecap: "round" }),
  arrow: svg(<path d="M3 13L13 3M7 3h6v6" />, 1.5, { strokeLinecap: "round" }),
  cross: svg(<path d="M4 4l8 8M12 4l-8 8" />, 1.5, { strokeLinecap: "round" }),
  pen: svg(<path d="M3 13l1-3.6 7-7 2.6 2.6-7 7z M9.6 3.8l2.6 2.6" />, 1.5, { strokeLinejoin: "round" }),
  text: svg(<path d="M3.5 3.5h9M8 3.5v9.5" />, 1.6),
  cut: svg(
    <>
      <circle cx="4.8" cy="11.8" r="2" />
      <circle cx="11.2" cy="11.8" r="2" />
      <path d="M6.2 10.4L12 2.5M9.8 10.4L4 2.5" />
    </>,
    1.4,
  ),
};

export const CAPTURE_ICON = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 5V3.5c0-.8.7-1.5 1.5-1.5H5M11 2h1.5c.8 0 1.5.7 1.5 1.5V5M14 11v1.5c0 .8-.7 1.5-1.5 1.5H11M5 14H3.5c-.8 0-1.5-.7-1.5-1.5V11" />
    <circle cx="8" cy="8" r="2.2" />
  </svg>
);

export const CHEVRON = (
  <svg width="7" height="7" viewBox="0 0 8 8">
    <path d="M1.5 2.8L4 5.3l2.5-2.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);
