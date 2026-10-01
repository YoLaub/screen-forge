import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Pill from "./Pill";
import "./index.css";
import { applyTheme } from "./theme/appearance";

applyTheme();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {new URLSearchParams(window.location.search).get("window") === "pill" ? <Pill /> : <App />}
  </React.StrictMode>,
);
