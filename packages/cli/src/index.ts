// Re-export server functionality for programmatic use
export { startServer, createServer } from "@mcpconnect/server";
export type { ServerOptions } from "@mcpconnect/server";

// CLI-specific exports
export * from "./cli.js";
