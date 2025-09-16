import { z } from "zod";
import { BaseConfigSchema, AdapterError, AdapterStatus } from "./types";

/**
 * LLM message schema
 */
export const LLMMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.string(),
  name: z.string().optional(),
  toolCallId: z.string().optional(),
  toolCalls: z
    .array(
      z.object({
        id: z.string(),
        type: z.literal("function"),
        function: z.object({
          name: z.string(),
          arguments: z.string(), // JSON string
        }),
      })
    )
    .optional(),
});

export type LLMMessage = z.infer<typeof LLMMessageSchema>;

/**
 * LLM tool definition schema
 */
export const LLMToolSchema = z.object({
  type: z.literal("function"),
  function: z.object({
    name: z.string(),
    description: z.string(),
    parameters: z.record(z.string(), z.unknown()).optional(),
  }),
});

export type LLMTool = z.infer<typeof LLMToolSchema>;

/**
 * LLM tool call schema
 */
export const LLMToolCallSchema = z.object({
  id: z.string(),
  type: z.literal("function"),
  function: z.object({
    name: z.string(),
    arguments: z.string(), // JSON string
  }),
});

export type LLMToolCall = z.infer<typeof LLMToolCallSchema>;

/**
 * LLM tool result schema
 */
export const LLMToolResultSchema = z.object({
  toolCallId: z.string(),
  result: z.unknown(),
  error: z.string().optional(),
});

/**
 * LLM usage statistics schema
 */
export const LLMUsageSchema = z.object({
  promptTokens: z.number().min(0),
  completionTokens: z.number().min(0),
  totalTokens: z.number().min(0),
  cost: z.number().min(0).optional(),
});

export type LLMUsage = z.infer<typeof LLMUsageSchema>;

/**
 * LLM response schema
 */
export const LLMResponseSchema = z.object({
  id: z.string(),
  content: z.string().optional(),
  finishReason: z
    .enum(["stop", "length", "tool_calls", "content_filter"])
    .optional(),
  toolCalls: z.array(LLMToolCallSchema).optional(),
  usage: LLMUsageSchema.optional(),
  model: z.string(),
  timestamp: z.date(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type LLMResponse = z.infer<typeof LLMResponseSchema>;

/**
 * LLM streaming response schema
 */
export const LLMStreamResponseSchema = z.object({
  id: z.string(),
  delta: z.object({
    content: z.string().optional(),
    toolCalls: z
      .array(
        z.object({
          index: z.number(),
          id: z.string().optional(),
          type: z.literal("function").optional(),
          function: z
            .object({
              name: z.string().optional(),
              arguments: z.string().optional(),
            })
            .optional(),
        })
      )
      .optional(),
  }),
  finishReason: z
    .enum(["stop", "length", "tool_calls", "content_filter"])
    .optional(),
  usage: LLMUsageSchema.optional(),
  model: z.string(),
});

export type LLMStreamResponse = z.infer<typeof LLMStreamResponseSchema>;

/**
 * LLM configuration schema
 */
export const LLMConfigSchema = BaseConfigSchema.extend({
  provider: z.string(),
  model: z.string(),
  apiKey: z.string().optional(),
  baseUrl: z
    .string()
    .url()
    .optional()
    .or(z.literal(""))
    .transform(val => (val === "" ? undefined : val)),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().positive().optional(),
  topP: z.number().min(0).max(1).optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  presencePenalty: z.number().min(-2).max(2).optional(),
  stop: z.array(z.string()).optional(),
  stream: z.boolean().default(false),
  tools: z.array(LLMToolSchema).optional(),
  toolChoice: z
    .union([
      z.literal("none"),
      z.literal("auto"),
      z.object({
        type: z.literal("function"),
        function: z.object({
          name: z.string(),
        }),
      }),
    ])
    .optional(),
});

export type LLMConfig = z.infer<typeof LLMConfigSchema>;

/**
 * LLM capabilities schema
 */
export const LLMCapabilitiesSchema = z.object({
  streaming: z.boolean(),
  tools: z.boolean(),
  systemMessages: z.boolean(),
  multiModal: z.boolean(),
  maxContextLength: z.number().positive(),
  supportedModalities: z.array(z.enum(["text", "image", "audio", "video"])),
  costPerToken: z
    .object({
      input: z.number().min(0),
      output: z.number().min(0),
    })
    .optional(),
});

export type LLMCapabilities = z.infer<typeof LLMCapabilitiesSchema>;

/**
 * Abstract base class for LLM adapters
 */
export abstract class LLMAdapter {
  protected config: LLMConfig;
  protected status: AdapterStatus = AdapterStatus.IDLE;

  constructor(config: LLMConfig) {
    this.config = LLMConfigSchema.parse(config);
  }

  /**
   * Get adapter status
   */
  getStatus(): AdapterStatus {
    return this.status;
  }

  /**
   * Get adapter configuration
   */
  getConfig(): LLMConfig {
    return { ...this.config };
  }

  /**
   * Get adapter capabilities
   */
  abstract getCapabilities(): Promise<LLMCapabilities>;

  /**
   * Initialize the adapter
   */
  abstract initialize(): Promise<void>;

  /**
   * Test connection to the LLM provider
   */
  abstract testConnection(): Promise<boolean>;

  /**
   * Generate completion from messages
   */
  abstract complete(
    messages: LLMMessage[],
    options?: Partial<LLMConfig>
  ): Promise<LLMResponse>;

  /**
   * Generate streaming completion from messages
   */
  abstract stream(
    messages: LLMMessage[],
    options?: Partial<LLMConfig>
  ): AsyncIterable<LLMStreamResponse>;

  /**
   * Validate tool definition
   */
  validateTool(tool: LLMTool): boolean {
    try {
      LLMToolSchema.parse(tool);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clean up resources
   */
  abstract cleanup(): Promise<void>;

  /**
   * Update configuration
   */
  updateConfig(config: Partial<LLMConfig>): void {
    this.config = LLMConfigSchema.parse({ ...this.config, ...config });
  }

  /**
   * Handle errors consistently
   */
  protected handleError(error: unknown, context: string): never {
    if (error instanceof AdapterError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new AdapterError(
      `LLM adapter error in ${context}: ${message}`,
      "LLM_ADAPTER_ERROR",
      { context, originalError: error }
    );
  }
}
