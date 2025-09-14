import { z } from "zod";

/**
 * Schema for MCP resource definition
 */
export const ResourceSchema = z.object({
  name: z.string().min(1, "Resource name is required"),
  description: z.string().min(1, "Resource description is required"),
  type: z.string().optional(),
  uri: z.string().optional(),
  mimeType: z.string().optional(),
  size: z.number().optional(),
  lastModified: z.date().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  permissions: z
    .object({
      read: z.boolean().optional().default(true),
      write: z.boolean().optional().default(false),
      delete: z.boolean().optional().default(false),
    })
    .optional(),
  tags: z.array(z.string()).optional(),
});

export type Resource = z.infer<typeof ResourceSchema>;

/**
 * Schema for resource access request
 */
export const ResourceAccessRequestSchema = z.object({
  resourceId: z.string(),
  operation: z.enum(["read", "write", "delete"]),
  parameters: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ResourceAccessRequest = z.infer<typeof ResourceAccessRequestSchema>;

/**
 * Schema for resource access response
 */
export const ResourceAccessResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  contentType: z.string().optional(),
  size: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ResourceAccessResponse = z.infer<
  typeof ResourceAccessResponseSchema
>;
