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
            scriptSrc: [
              "'self'",
              "'unsafe-inline'",
              "https://www.googletagmanager.com",
              "'unsafe-eval'",
            ],
            imgSrc: ["'self'", "data:", "https:"],
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
              "https://api.anthropic.com",
              "https://www.google-analytics.com",
              "https://analytics.google.com",
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

  // Add compression middleware
  app.use(
    compression({
      filter: (req, res) => {
        if (req.headers["x-no-compression"]) {
          return false;
        }
        return compression.filter(req, res);
      },
      level: 6,
      threshold: 1024,
      memLevel: 8,
    })
  );

  // Enhanced static file serving with better MIME type handling
  app.use(
    express.static(uiBuildPath, {
      maxAge: "1y", // Cache static assets for 1 year
      etag: true,
      lastModified: true,
      setHeaders: (res, filePath) => {
        // Enhanced MIME type detection
        const ext = path.extname(filePath).toLowerCase();

        switch (ext) {
          case ".js":
          case ".mjs":
            res.setHeader(
              "Content-Type",
              "application/javascript; charset=utf-8"
            );
            break;
          case ".css":
            res.setHeader("Content-Type", "text/css; charset=utf-8");
            break;
          case ".html":
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.setHeader("Cache-Control", "no-cache"); // Don't cache HTML
            break;
          case ".json":
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            break;
          case ".svg":
            res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
            break;
          case ".png":
            res.setHeader("Content-Type", "image/png");
            break;
          case ".jpg":
          case ".jpeg":
            res.setHeader("Content-Type", "image/jpeg");
            break;
          case ".gif":
            res.setHeader("Content-Type", "image/gif");
            break;
          case ".webp":
            res.setHeader("Content-Type", "image/webp");
            break;
          case ".ico":
            res.setHeader("Content-Type", "image/x-icon");
            break;
          case ".woff":
            res.setHeader("Content-Type", "font/woff");
            break;
          case ".woff2":
            res.setHeader("Content-Type", "font/woff2");
            break;
          case ".ttf":
            res.setHeader("Content-Type", "font/ttf");
            break;
          case ".eot":
            res.setHeader("Content-Type", "application/vnd.ms-fontobject");
            break;
          case ".xml":
            res.setHeader("Content-Type", "application/xml; charset=utf-8");
            break;
          case ".txt":
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            break;
          default:
            // Let Express handle other types
            break;
        }

        // Cache control for non-HTML files
        if (ext !== ".html") {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    })
  );

  // Function to check if a request is for a static asset
  function isAssetRequest(reqPath: string): boolean {
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

  // Catch-all handler for SPA routing - IMPORTANT: This must be last
  app.get("*", (req, res) => {
    const reqPath = req.path;

    // Don't serve index.html for API routes
    if (reqPath.startsWith("/api/") || reqPath.startsWith("/health")) {
      return res.status(404).json({ error: "API endpoint not found" });
    }

    // Check if this is a static asset request that wasn't handled by express.static
    if (isAssetRequest(reqPath)) {
      // The express.static middleware should have handled this already
      // If we get here, the file doesn't exist
      return res.status(404).json({ error: "Asset not found" });
    }

    // Serve index.html for SPA routes (all non-asset, non-API requests)
    const indexPath = path.join(uiBuildPath, "index.html");
    res.sendFile(indexPath, err => {
      if (err) {
        console.error("Error serving index.html:", err);
        res.status(500).json({ error: "Internal server error" });
      }
    });
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
      console.log(`Static files served from: ${findUiBuildPath()}`);
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
