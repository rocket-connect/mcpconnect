import {
  LLMConfigSchema,
  LLMMessage,
  LLMToolCall,
} from "@mcpconnect/base-adapters";
import {
  Connection,
  Tool,
  ChatMessage,
  ToolExecution,
} from "@mcpconnect/schemas";
import { z } from "zod";
import {
  LanguageModel,
  AssistantContent,
  AssistantModelMessage,
  UserModelMessage,
  SystemModelMessage,
  ToolModelMessage,
  ToolContent,
  ToolCallPart,
} from "ai";

/**
 * Extended LLM message interface for AI SDK compatibility
 */
export interface ExtendedLLMMessage extends LLMMessage {
  name?: string; // Tool name for tool messages
  toolCallId?: string; // Tool call ID for tool messages
  toolCalls?: LLMToolCall[]; // Tool calls for assistant messages
}

/**
 * AI SDK-specific configuration schema
 */
export const AISDKConfigSchema = LLMConfigSchema.extend({
  provider: z.enum(["anthropic"]),
  modelProvider: z.unknown().optional(),
}).transform(data => ({
  ...data,
  baseUrl: data.baseUrl === "" ? undefined : data.baseUrl,
}));

export type AISDKConfig = z.infer<typeof AISDKConfigSchema>;

/**
 * Chat context for tool-enabled conversations
 */
export interface ChatContext {
  connection: Connection;
  tools: Tool[];
  llmSettings: LLMSettings;
}

/**
 * Chat response with tool executions
 */
export interface ChatResponse {
  assistantMessage: ChatMessage;
  toolExecutionMessages: ChatMessage[];
}

/**
 * Streaming chat response for SSE
 */
export interface StreamingChatResponse {
  type: "token" | "tool_start" | "tool_end" | "message_complete" | "error";
  content?: string;
  delta?: string;
  toolName?: string;
  toolResult?: any;
  toolExecution?: ToolExecution;
  assistantMessage?: ChatMessage;
  toolExecutionMessages?: ChatMessage[];
  error?: string;
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  toolExecution: ToolExecution;
  chatMessage: ChatMessage;
}

/**
 * LLM Settings for model configuration
 */
export interface LLMSettings {
  provider: "anthropic";
  apiKey: string;
  model: string;
  baseUrl?: string;
  temperature: number;
  maxTokens: number;
}

/**
 * Model options for UI
 */
export interface ModelOption {
  value: string;
  label: string;
  description?: string;
}

/**
 * AI Model Message Types
 */
export type AIModelMessage =
  | AssistantModelMessage
  | UserModelMessage
  | SystemModelMessage
  | ToolModelMessage;

/**
 * Tool result for LLM consumption
 */
export interface ToolResultForLLM {
  toolCallId: string;
  result: any;
  rawResult: any;
  error?: string;
}

/**
 * AI Model instance type
 */
export type AIModel = LanguageModel;
