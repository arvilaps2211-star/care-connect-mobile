import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import App from "./App.tsx";
import "./index.css";

// Initialize Capacitor for native platforms
import { Capacitor } from '@capacitor/core';

console.log('[CareConnect] Starting app on platform:', Capacitor.getPlatform());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
