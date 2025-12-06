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
  ToolSelectionProvider,
  ToolSelectionCallbacks,
} from "@mcpconnect/schemas";
import { z } from "zod";
import {
  LanguageModel,
  AssistantModelMessage,
  UserModelMessage,
  SystemModelMessage,
  ToolModelMessage,
} from "ai";

export interface ExtendedLLMMessage extends LLMMessage {
  name?: string; // Tool name for tool messages
  toolCallId?: string; // Tool call ID for tool messages
  toolCalls?: LLMToolCall[]; // Tool calls for assistant messages
}

export const AISDKConfigSchema = LLMConfigSchema.extend({
  provider: z.enum(["anthropic", "openai"]),
  modelProvider: z.unknown().optional(),
}).transform(data => ({
  ...data,
  baseUrl: data.baseUrl === "" ? undefined : data.baseUrl,
}));

export type AISDKConfig = z.infer<typeof AISDKConfigSchema>;

export interface ChatContext {
  connection: Connection;
  tools: Tool[];
  llmSettings: LLMSettings;
  toolSelectionProvider?: ToolSelectionProvider;
  toolSelectionOptions?: {
    maxTools?: number;
    includeHistory?: boolean;
    fallbackToAll?: boolean;
  };
  toolSelectionCallbacks?: ToolSelectionCallbacks;
}

export interface ChatResponse {
  assistantMessage: ChatMessage;
  toolExecutionMessages: ChatMessage[];
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface StreamingChatResponse {
  type:
    | "token"
    | "tool_start"
    | "tool_end"
    | "message_complete"
    | "error"
    | "assistant_partial";
  content?: string;
  delta?: string;
  toolName?: string;
  toolResult?: any;
  toolExecution?: ToolExecution;
  assistantMessage?: ChatMessage;
  toolExecutionMessages?: ChatMessage[];
  finalAssistantMessage?: ChatMessage; // NEW: Separate final response message
  error?: string;
  hasToolCalls?: boolean; // Indicates more content will follow after tools
  partialMessageId?: string; // NEW: ID for partial message tracking
  messageOrder?: number; // NEW: Explicit message order
  usage?: TokenUsage; // Token usage for this response
}

export interface ToolExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  toolExecution: ToolExecution;
  chatMessage: ChatMessage;
}

export interface LLMSettings {
  provider: "anthropic" | "openai";
  apiKey: string;
  model: string;
  baseUrl?: string;
  temperature: number;
  maxTokens: number;
}

export interface ModelOption {
  value: string;
  label: string;
  description?: string;
}

export type AIModelMessage =
  | AssistantModelMessage
  | UserModelMessage
  | SystemModelMessage
  | ToolModelMessage;

export type AIModel = LanguageModel;
