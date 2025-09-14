import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3001;

// Get current directory in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  })
);
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "MCPConnect server running" });
});

// API routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "MCPConnect API running" });
});

// Serve static files from UI build (via node_modules)
const uiBuildPath = path.join(
  __dirname,
  "..",
  "node_modules",
  "@mcpconnect",
  "ui",
  "dist"
);
app.use(express.static(uiBuildPath));

// Catch-all handler for SPA routing
app.get("*", (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith("/api/") || req.path.startsWith("/health")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }

  res.sendFile(path.join(uiBuildPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`MCPConnect server running on port ${PORT}`);
  console.log(`UI available at http://localhost:${PORT}`);
});
