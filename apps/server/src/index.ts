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
  // Same logic as before...
  const possiblePaths = [
    path.join(__dirname, "..", "node_modules", "@mcpconnect", "ui", "dist"),
    path.join(__dirname, "..", "..", "..", "apps", "ui", "dist"),
    path.join(__dirname, "..", "..", "@mcpconnect", "ui", "dist"),
    path.join(__dirname, "..", "..", "ui", "dist"),
    path.join(process.cwd(), "node_modules", "@mcpconnect", "ui", "dist"),
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
              "'unsafe-inline'", // Required for dynamic styles
              "https://fonts.googleapis.com",
            ],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: [
              "'self'",
              "'unsafe-inline'", // Required for inline scripts like Google Analytics
              "https://www.googletagmanager.com",
              "'unsafe-eval'", // May be needed for some bundled JS
            ],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: [
              "'self'",
              // Local development
              "http://localhost:*",
              "https://localhost:*",
              "ws://localhost:*",
              "wss://localhost:*",
              "http://127.0.0.1:*",
              "https://127.0.0.1:*",
              "ws://127.0.0.1:*",
              "wss://127.0.0.1:*",
              // APIs
              "https://api.anthropic.com",
              "https://www.google-analytics.com",
              "https://analytics.google.com",
              // MCP endpoints
              "http://*:*",
              "https://*:*",
              "ws://*:*",
              "wss://*:*",
            ],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
          },
        },
        crossOriginEmbedderPolicy: false,
      })
    );
  }

  if (enableCors) {
    app.use(
      cors({
        origin: true,
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

  // Get UI build path
  const uiBuildPath = findUiBuildPath();

  // Serve static UI files with proper MIME types
  app.use(
    express.static(uiBuildPath, {
      setHeaders: (res, path) => {
        // Ensure proper MIME types
        if (path.endsWith(".js")) {
          res.setHeader("Content-Type", "application/javascript");
        } else if (path.endsWith(".css")) {
          res.setHeader("Content-Type", "text/css");
        } else if (path.endsWith(".html")) {
          res.setHeader("Content-Type", "text/html");
        } else if (path.endsWith(".json")) {
          res.setHeader("Content-Type", "application/json");
        } else if (path.endsWith(".svg")) {
          res.setHeader("Content-Type", "image/svg+xml");
        }

        // Cache static assets for 1 hour, but not HTML
        if (!path.endsWith(".html")) {
          res.setHeader("Cache-Control", "public, max-age=3600");
        }
      },
    })
  );

  // Catch-all handler for SPA routing - IMPORTANT: This must be last
  app.get("*", (req, res) => {
    // Don't serve index.html for API routes or asset requests
    if (
      req.path.startsWith("/api/") ||
      req.path.startsWith("/health") ||
      req.path.includes(".")
    ) {
      // Likely an asset request
      return res.status(404).json({ error: "Resource not found" });
    }

    // Serve index.html for SPA routes
    res.sendFile(path.join(uiBuildPath, "index.html"));
  });

  return { app: app, port, host };
}

// Rest of the file remains the same...
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

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch(err => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}
