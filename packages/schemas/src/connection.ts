import { z } from "zod";

/**
 * Schema for MCP server connection configuration
 */
export const ConnectionSchema = z.object({
  id: z.string().min(1, "Connection ID is required"), // NEW: ID field for proper identification
  name: z.string().min(1, "Connection name is required"),
  url: z.string().url("Must be a valid URL"),
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
