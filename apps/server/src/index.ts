import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import compression from "compression";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ServerOptions {
  port?: number;
  host?: string;
  cors?: boolean;
  helmet?: boolean;
}

function findUiBuildPath(): string {
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

  app.get("/health", (req, res) => {
    res.json({ status: "ok", message: "MCPConnect server running" });
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "MCPConnect API running" });
  });

  const uiBuildPath = findUiBuildPath();

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

  // Helper function to check if request is for a static asset
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

  // CRITICAL: Static file serving with proper fallback handling
  app.use(
    express.static(uiBuildPath, {
      maxAge: "1y",
      etag: true,
      lastModified: true,
      fallthrough: true, // IMPORTANT: Allow requests to continue if file not found
      setHeaders: (res, filePath) => {
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
            res.setHeader("Cache-Control", "no-cache");
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
            break;
        }

        if (ext !== ".html") {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    })
  );

  // CRITICAL: Catch-all route for SPA client-side routing
  // This MUST come after static middleware and handle ALL non-API routes
  app.get("*", (req, res) => {
    const reqPath = req.path;

    // Don't serve index.html for API routes
    if (reqPath.startsWith("/api/") || reqPath.startsWith("/health")) {
      return res.status(404).json({ error: "API endpoint not found" });
    }

    // If it's a request for a specific asset that wasn't found, return 404
    if (isAssetRequest(reqPath)) {
      return res.status(404).send("Asset not found");
    }

    // For all other routes (client-side routes), serve index.html
    const indexPath = path.join(uiBuildPath, "index.html");

    // Use sendFile with proper error handling
    res.sendFile(indexPath, err => {
      if (err) {
        console.error("Error serving index.html:", err);
        res.status(500).send("Internal server error");
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
      console.log(
        `Server configured for SPA routing - all routes will serve index.html`
      );
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
