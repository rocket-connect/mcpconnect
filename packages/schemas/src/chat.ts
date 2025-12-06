import { z } from "zod";

const flexibleDateSchema = z
  .union([
    z.date(),
    z.string().transform(val => new Date(val)),
    z.number().transform(val => new Date(val)),
  ])
  .optional();

export const ChatMessageSchema = z.object({
  id: z.string().optional(),
  message: z.string().optional(),
  isUser: z.boolean().optional().default(false),
  isExecuting: z.boolean().optional().default(false),
  executingTool: z.string().optional(),
  timestamp: flexibleDateSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),

  isPartial: z.boolean().optional().default(false),
  messageOrder: z.number().optional(),
  partialMessageId: z.string().optional(),
  relatedPartialId: z.string().optional(),

  toolExecution: z
    .object({
      toolName: z.string(),
      status: z.enum(["pending", "success", "error"]),
      result: z.unknown().optional(),
      error: z.string().optional(),
      timestamp: flexibleDateSchema,
      startTime: z.number().optional(), // Unix timestamp in ms
      endTime: z.number().optional(), // Unix timestamp in ms
      duration: z.number().optional(), // Duration in ms
    })
    .optional(),

  // Semantic search results attached to user messages
  semanticSearch: z
    .object({
      searchId: z.string(),
      relevantTools: z.array(
        z.object({
          name: z.string(),
          score: z.number(),
        })
      ),
      totalTools: z.number(),
      duration: z.number(), // Duration in ms
    })
    .optional(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export interface ExtendedChatMessage extends ChatMessage {
  isPartial: boolean;
}

export const TokenUsageSchema = z.object({
  promptTokens: z.number().default(0),
  completionTokens: z.number().default(0),
  totalTokens: z.number().default(0),
  lastUpdated: flexibleDateSchema,
});

export type TokenUsage = z.infer<typeof TokenUsageSchema>;

export const ChatConversationSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  messages: z.array(ChatMessageSchema),
  createdAt: flexibleDateSchema.transform(val => val || new Date()),
  updatedAt: flexibleDateSchema.transform(val => val || new Date()),
  metadata: z.record(z.string(), z.unknown()).optional(),
  tokenUsage: TokenUsageSchema.optional(),
  settings: z
    .object({
      model: z.string().optional(),
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().positive().optional(),
      systemPrompt: z.string().optional(),
    })
    .optional(),
});

export type ChatConversation = z.infer<typeof ChatConversationSchema>;

// Helper functions remain the same
export function normalizeTimestamp(
  timestamp: Date | string | number | undefined
): Date {
  if (!timestamp) return new Date();
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === "string") return new Date(timestamp);
  if (typeof timestamp === "number") return new Date(timestamp);
  return new Date();
}

export function timestampToISO(
  timestamp: Date | string | number | undefined
): string {
  return normalizeTimestamp(timestamp).toISOString();
}

export function formatTimestampDisplay(
  timestamp: Date | string | number | undefined
): string {
  const date = normalizeTimestamp(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// New helper to format duration
export function formatDuration(durationMs: number | undefined): string {
  if (!durationMs) return "—";
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }
  return `${(durationMs / 1000).toFixed(2)}s`;
}
