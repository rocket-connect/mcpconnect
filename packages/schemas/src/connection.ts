// packages/schemas/src/connection.ts
import { z } from "zod";

/**
 * Schema for MCP connection types
 */
export const ConnectionTypeSchema = z.enum(["sse", "http", "websocket"]);

export type ConnectionType = z.infer<typeof ConnectionTypeSchema>;

/**
 * Schema for CORS configuration
 */
export const CorsConfigSchema = z.object({
  enabled: z.boolean().default(false),
  origin: z.string().default("*"),
  methods: z.string().default("GET,POST,PUT,DELETE,OPTIONS"),
  allowedHeaders: z.string().default("Content-Type,Authorization,X-API-Key"),
  credentials: z.boolean().default(true),
});

export type CorsConfig = z.infer<typeof CorsConfigSchema>;

/**
 * Schema for MCP server connection configuration
 */
export const ConnectionSchema = z.object({
  id: z.string().min(1, "Connection ID is required"),
  name: z.string().min(1, "Connection name is required"),
  url: z.string().url("Must be a valid URL"),
  connectionType: ConnectionTypeSchema.default("sse"),
  isActive: z.boolean().optional().default(false),
  isConnected: z.boolean().optional().default(false),
  headers: z.record(z.string(), z.string()).optional().default({}),
  timeout: z.number().positive().optional().default(30000),
  retryAttempts: z.number().min(0).optional().default(3),
  authType: z
    .enum(["none", "bearer", "apiKey", "basic"])
    .optional()
    .default("none"),
  credentials: z
    .object({
      token: z.string().optional(),
      apiKey: z.string().optional(),
      username: z.string().optional(),
      password: z.string().optional(),
    })
    .optional()
    .default({}),
  cors: CorsConfigSchema.optional(),
});

/**
 * Inferred TypeScript type from ConnectionSchema
 */
export type Connection = z.infer<typeof ConnectionSchema>;

/**
 * Schema for connection status updates
 */
export const ConnectionStatusSchema = z.object({
  connectionId: z.string(),
  isConnected: z.boolean(),
  lastConnected: z.date().optional(),
  error: z.string().optional(),
  latency: z.number().optional(),
});

export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>;
