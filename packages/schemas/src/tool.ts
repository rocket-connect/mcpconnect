import { z } from "zod";

/**
 * Schema for MCP tool definition
 */
export const ToolSchema = z.object({
  name: z.string().min(1, "Tool name is required"),
  description: z.string().min(1, "Tool description is required"),
  inputSchema: z.record(z.string(), z.unknown()).optional(),
  parameters: z
    .array(
      z.object({
        name: z.string(),
        type: z.enum(["string", "number", "boolean", "object", "array"]),
        description: z.string().optional(),
        required: z.boolean().optional().default(false),
        default: z.unknown().optional(),
      })
    )
    .optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  version: z.string().optional(),
  deprecated: z.boolean().optional().default(false),
});

export type Tool = z.infer<typeof ToolSchema>;

/**
 * Schema for tool execution request
 */
export const ToolExecutionRequestSchema = z.object({
  tool: z.string(),
  arguments: z.record(z.string(), z.unknown()).optional(),
  timeout: z.number().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ToolExecutionRequest = z.infer<typeof ToolExecutionRequestSchema>;

/**
 * Schema for tool execution response
 */
export const ToolExecutionResponseSchema = z.object({
  success: z.boolean(),
  result: z.unknown().optional(),
  error: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  executionTime: z.number().optional(),
});

export type ToolExecutionResponse = z.infer<typeof ToolExecutionResponseSchema>;

/**
 * Schema for tool execution (used in NetworkInspector)
 */
export const ToolExecutionSchema = z.object({
  id: z.string(),
  tool: z.string(),
  status: z.enum(["success", "error", "pending"]),
  duration: z.number().optional(),
  timestamp: z.string(),
  request: z.object({
    tool: z.string(),
    arguments: z.record(z.string(), z.unknown()).optional(),
    timestamp: z.string().optional(),
  }),
  response: z
    .object({
      success: z.boolean(),
      result: z.unknown().optional(),
      timestamp: z.string().optional(),
    })
    .optional(),
  error: z.string().optional(),
});

export type ToolExecution = z.infer<typeof ToolExecutionSchema>;
