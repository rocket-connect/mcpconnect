import { z } from "zod";

/**
 * Schema for server configuration options
 */
export const ServerOptionsSchema = z.object({
  port: z.number().int().min(1).max(65535).optional(),
  host: z.string().optional(),
  cors: z.boolean().optional(),
  helmet: z.boolean().optional(),
  staticPath: z.string().optional(),
  apiPrefix: z.string().optional().default("/api"),
  logLevel: z
    .enum(["error", "warn", "info", "debug"])
    .optional()
    .default("info"),
  maxRequestSize: z.string().optional(),
  rateLimit: z
    .object({
      windowMs: z.number().positive(),
      max: z.number().positive(),
      message: z.string().optional(),
    })
    .optional(),
});

export type ServerOptions = z.infer<typeof ServerOptionsSchema>;
