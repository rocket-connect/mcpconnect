import { z } from "zod";

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
