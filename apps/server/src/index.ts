import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const app = express();

// Get current directory in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ServerOptions {
  port?: number;
  host?: string;
  cors?: boolean;
  helmet?: boolean;
}

function findUiBuildPath(): string {
  // Possible UI build paths in order of preference
  const possiblePaths = [
    // When running from built CLI (most common case)
    path.join(__dirname, "..", "node_modules", "@mcpconnect", "ui", "dist"),
    // When running locally in monorepo
    path.join(__dirname, "..", "..", "..", "apps", "ui", "dist"),
    // When UI is a peer dependency
    path.join(__dirname, "..", "..", "@mcpconnect", "ui", "dist"),
    // Alternative monorepo structure
    path.join(__dirname, "..", "..", "ui", "dist"),
    // Try relative to current working directory
    path.join(process.cwd(), "node_modules", "@mcpconnect", "ui", "dist"),
    // Fallback: try to find UI package anywhere up the tree
    path.join(
      __dirname,
      "..",
      "..",
      "..",
      "node_modules",
      "@mcpconnect",
      "ui",
      "dist"
    ),
  ];

  for (const uiPath of possiblePaths) {
    const indexPath = path.join(uiPath, "index.html");
    if (existsSync(indexPath)) {
      console.log(`Found UI build at: ${uiPath}`);
      return uiPath;
    }
  }

  throw new Error(
    "UI build not found. Please run 'pnpm build' in the monorepo or install the @mcpconnect/ui package."
  );
}

// @ts-ignore
export function createServer(options: ServerOptions = {}): {
  app: express.Express;
  port: number;
  host: string;
} {
  const {
    port = process.env.PORT ? parseInt(process.env.PORT) : 3001,
    host = "localhost",
    cors: enableCors = true,
    helmet: enableHelmet = true,
  } = options;

  if (enableHelmet) {
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: [
              "'self'",
              "'unsafe-inline'",
              "https://fonts.googleapis.com",
            ],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            // CRITICAL: Allow connections to local MCP servers and external APIs
            connectSrc: [
              "'self'",
              "http://localhost:*",
              "https://localhost:*",
              "ws://localhost:*",
              "wss://localhost:*",
              "http://127.0.0.1:*",
              "https://127.0.0.1:*",
              "ws://127.0.0.1:*",
              "wss://127.0.0.1:*",
              // Allow Anthropic API
              "https://api.anthropic.com",
              // Allow other common MCP endpoints
              "http://*:*",
              "https://*:*",
              "ws://*:*",
              "wss://*:*",
            ],
          },
        },
        crossOriginEmbedderPolicy: false, // Disable for better compatibility
      })
    );
  }

  if (enableCors) {
    app.use(
      cors({
        origin: true, // Allow all origins in development
        credentials: true,
      })
    );
  }

  app.use(express.json());

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.json({ status: "ok", message: "MCPConnect server running" });
  });

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "MCPConnect API running" });
  });

  // Serve static UI files or throw error if not found
  const uiBuildPath = findUiBuildPath();

  app.use(express.static(uiBuildPath));

  // Catch-all handler for SPA routing
  app.get("*", (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith("/api/") || req.path.startsWith("/health")) {
      return res.status(404).json({ error: "API endpoint not found" });
    }

    res.sendFile(path.join(uiBuildPath, "index.html"));
  });

  return { app: app, port, host };
}

export function startServer(
  options: ServerOptions = {}
): Promise<{ port: number; host: string; url: string }> {
  return new Promise((resolve, reject) => {
    const { app, port, host } = createServer(options);

    const server = app.listen(port, host, () => {
      const url = `http://${host}:${port}`;
      console.log(`MCPConnect server running on ${url}`);
      console.log(`UI available at ${url}`);
      resolve({ port, host, url });
    });

    server.on("error", err => {
      reject(err);
    });
  });
}

// Direct execution (when running the server directly)
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch(err => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}
