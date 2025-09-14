import { z } from "zod";

/**
 * Schema for chat message
 */
export const ChatMessageSchema = z.object({
  id: z.string().optional(),
  message: z.string().optional(),
  isUser: z.boolean().optional().default(false),
  isExecuting: z.boolean().optional().default(false),
  executingTool: z.string().optional(),
  timestamp: z.date().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  toolExecution: z
    .object({
      toolName: z.string(),
      status: z.enum(["pending", "success", "error"]),
      result: z.unknown().optional(),
      error: z.string().optional(),
    })
    .optional(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

/**
 * Schema for chat conversation
 */
export const ChatConversationSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  messages: z.array(ChatMessageSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
  metadata: z.record(z.string(), z.unknown()).optional(),
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

/**
 * Schema for chat session
 */
export const ChatSessionSchema = z.object({
  id: z.string(),
  userId: z.string().optional(),
  conversations: z.array(ChatConversationSchema),
  activeConversationId: z.string().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.date(),
  lastActivity: z.date(),
});

export type ChatSession = z.infer<typeof ChatSessionSchema>;
