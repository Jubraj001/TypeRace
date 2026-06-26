import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import App from "./App";
import SoloPage from "./pages/SoloPage";
import RacePage from "./pages/RacePage";

// Load display + mono fonts with font-display: swap for fast first paint.
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href =
  "https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Share+Tech+Mono&display=swap";
document.head.appendChild(fontLink);

// Apply persisted theme before paint.
const savedTheme = localStorage.getItem("theme") ?? "neon-tokyo";
document.documentElement.setAttribute("data-theme", savedTheme);

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <SoloPage /> },
      { path: "race/:code?", element: <RacePage /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
