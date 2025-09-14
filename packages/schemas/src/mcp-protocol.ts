import { z } from "zod";

/**
 * Schema for MCP protocol version
 */
export const MCPVersionSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, "Invalid version format");

export type MCPVersion = z.infer<typeof MCPVersionSchema>;

/**
 * Schema for MCP transport types
 */
export const MCPTransportSchema = z.enum(["websocket", "http", "stdio"]);

export type MCPTransport = z.infer<typeof MCPTransportSchema>;

/**
 * Schema for MCP message types
 */
export const MCPMessageTypeSchema = z.enum([
  "request",
  "response",
  "notification",
  "error",
]);

export type MCPMessageType = z.infer<typeof MCPMessageTypeSchema>;

/**
 * Schema for base MCP message
 */
export const MCPMessageBaseSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  method: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Schema for MCP request message
 */
export const MCPRequestSchema = MCPMessageBaseSchema.extend({
  method: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
});

export type MCPRequest = z.infer<typeof MCPRequestSchema>;

/**
 * Schema for MCP response message
 */
export const MCPResponseSchema = MCPMessageBaseSchema.extend({
  result: z.unknown().optional(),
  error: z
    .object({
      code: z.number(),
      message: z.string(),
      data: z.unknown().optional(),
    })
    .optional(),
});

export type MCPResponse = z.infer<typeof MCPResponseSchema>;

/**
 * Schema for MCP notification message
 */
export const MCPNotificationSchema = z.object({
  jsonrpc: z.literal("2.0"),
  method: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
});

export type MCPNotification = z.infer<typeof MCPNotificationSchema>;

/**
 * Schema for MCP server capabilities
 */
export const MCPCapabilitiesSchema = z.object({
  tools: z.boolean().optional(),
  resources: z.boolean().optional(),
  prompts: z.boolean().optional(),
  logging: z.boolean().optional(),
  experimental: z.record(z.string(), z.boolean()).optional(),
});

export type MCPCapabilities = z.infer<typeof MCPCapabilitiesSchema>;

/**
 * Schema for MCP server initialization
 */
export const MCPInitializationSchema = z.object({
  protocolVersion: MCPVersionSchema,
  capabilities: MCPCapabilitiesSchema,
  serverInfo: z.object({
    name: z.string(),
    version: z.string(),
    description: z.string().optional(),
  }),
  clientInfo: z
    .object({
      name: z.string(),
      version: z.string(),
      description: z.string().optional(),
    })
    .optional(),
});

export type MCPInitialization = z.infer<typeof MCPInitializationSchema>;
