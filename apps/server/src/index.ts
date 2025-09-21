import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import compression from "compression";

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

  // Serve static UI files with proper MIME types and better asset detection
  app.use(
    express.static(uiBuildPath, {
      setHeaders: (res, filePath) => {
        // Ensure proper MIME types for common Vite assets
        if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) {
          res.setHeader(
            "Content-Type",
            "application/javascript; charset=utf-8"
          );
        } else if (filePath.endsWith(".css")) {
          res.setHeader("Content-Type", "text/css; charset=utf-8");
        } else if (filePath.endsWith(".html")) {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
        } else if (filePath.endsWith(".json")) {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
        } else if (filePath.endsWith(".svg")) {
          res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
        } else if (filePath.endsWith(".png")) {
          res.setHeader("Content-Type", "image/png");
        } else if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) {
          res.setHeader("Content-Type", "image/jpeg");
        } else if (filePath.endsWith(".gif")) {
          res.setHeader("Content-Type", "image/gif");
        } else if (filePath.endsWith(".webp")) {
          res.setHeader("Content-Type", "image/webp");
        } else if (filePath.endsWith(".ico")) {
          res.setHeader("Content-Type", "image/x-icon");
        } else if (filePath.endsWith(".woff")) {
          res.setHeader("Content-Type", "font/woff");
        } else if (filePath.endsWith(".woff2")) {
          res.setHeader("Content-Type", "font/woff2");
        } else if (filePath.endsWith(".ttf")) {
          res.setHeader("Content-Type", "font/ttf");
        } else if (filePath.endsWith(".eot")) {
          res.setHeader("Content-Type", "application/vnd.ms-fontobject");
        }

        // Cache static assets for 1 year, but not HTML
        if (!filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else {
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    })
  );

  app.use(
    compression({
      filter: (req, res) => {
        // Don't compress if the request has a 'x-no-compression' header
        if (req.headers["x-no-compression"]) {
          return false;
        }
        // Compress everything else
        return compression.filter(req, res);
      },
      level: 6, // Compression level (1-9, 6 is good balance)
      threshold: 1024, // Only compress files larger than 1KB
      memLevel: 8, // Memory usage (1-9, 8 is default)
    })
  );

  // Function to check if a request is for a static asset
  function isAssetRequest(reqPath: string): boolean {
    // Common asset extensions that Vite generates
    const assetExtensions = [
      ".js",
      ".mjs",
      ".css",
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".svg",
      ".ico",
      ".webp",
      ".woff",
      ".woff2",
      ".ttf",
      ".eot",
      ".json",
      ".xml",
      ".txt",
      ".pdf",
      ".zip",
      ".map",
    ];

    return assetExtensions.some(ext => reqPath.toLowerCase().endsWith(ext));
  }

  // Middleware to handle asset requests from any nested route
  app.get("*/assets/*", (req, res) => {
    // Extract the asset filename from the path
    const assetPath = req.path.substring(req.path.indexOf("/assets/") + 1);
    const fullAssetPath = path.join(uiBuildPath, assetPath);

    // Check if the asset exists
    if (existsSync(fullAssetPath)) {
      res.sendFile(fullAssetPath);
    } else {
      res.status(404).json({ error: "Asset not found" });
    }
  });

  // Catch-all handler for SPA routing - IMPORTANT: This must be last
  app.get("*", (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith("/api/") || req.path.startsWith("/health")) {
      return res.status(404).json({ error: "API endpoint not found" });
    }

    // Don't serve index.html for direct asset requests (not handled by middleware above)
    if (isAssetRequest(req.path) && !req.path.includes("/assets/")) {
      return res.status(404).json({ error: "Asset not found" });
    }

    // Serve index.html for SPA routes
    res.sendFile(path.join(uiBuildPath, "index.html"), err => {
      if (err) {
        console.error("Error serving index.html:", err);
        res.status(500).json({ error: "Internal server error" });
      }
    });
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
