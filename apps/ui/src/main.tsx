// apps/ui/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { ThemeProvider } from "./contexts/ThemeContext.tsx";
import { StorageProvider } from "./contexts/StorageContext.tsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <StorageProvider>
        <App />
      </StorageProvider>
    </ThemeProvider>
  </React.StrictMode>
);
