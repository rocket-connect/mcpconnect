import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";

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
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
          },
        },
      })
    );
  }

  if (enableCors) {
    app.use(cors());
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
