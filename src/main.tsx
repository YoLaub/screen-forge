import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Pill from "./Pill";
import RegionOverlay from "./RegionOverlay";
import "./index.css";
import { applyTheme } from "./theme/appearance";

applyTheme();

/** The same bundle serves the main window and the small windows the backend opens. */
function screen() {
  const kind = new URLSearchParams(window.location.search).get("window");
  if (kind === "pill") return <Pill />;
  if (kind === "region") return <RegionOverlay />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {screen()}
  </React.StrictMode>,
);
