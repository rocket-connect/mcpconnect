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

/**
 * Schema for server status
 */
export const ServerStatusSchema = z.object({
  status: z.enum(["starting", "running", "stopping", "stopped", "error"]),
  port: z.number().optional(),
  host: z.string().optional(),
  url: z.string().optional(),
  uptime: z.number().optional(),
  connections: z.number().optional(),
  lastError: z.string().optional(),
  version: z.string().optional(),
  buildInfo: z.record(z.string(), z.string()).optional(),
});

export type ServerStatus = z.infer<typeof ServerStatusSchema>;

/**
 * Schema for health check response
 */
export const HealthCheckSchema = z.object({
  status: z.enum(["ok", "error", "degraded"]),
  message: z.string(),
  timestamp: z.date(),
  uptime: z.number(),
  version: z.string().optional(),
  services: z
    .record(
      z.string(),
      z.object({
        status: z.enum(["ok", "error", "degraded"]),
        message: z.string().optional(),
        latency: z.number().optional(),
      })
    )
    .optional(),
});

export type HealthCheck = z.infer<typeof HealthCheckSchema>;
