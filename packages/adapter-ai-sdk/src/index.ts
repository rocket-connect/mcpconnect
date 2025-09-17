export { AISDKAdapter } from "./ai-sdk-adapter";
export type {
  AISDKConfig,
  ChatContext,
  ChatResponse,
  StreamingChatResponse,
  ToolExecutionResult,
  LLMSettings,
  ModelOption,
  ExtendedLLMMessage,
  ToolResultForLLM,
  AIModel,
  AIModelMessage,
} from "./types";

export { AnthropicProvider } from "./providers/anthropic";
export { MCPService } from "./mcp-service";

// Re-export utilities for external use if needed
export {
  generateId,
  convertMCPToolToTool,
  convertToAIMessages,
  convertToAITools,
  createThinkingMessage,
  createAssistantMessage,
  getErrorMessage,
  validateChatContext,
  formatToolResultForLLM,
  conversationToLLMMessages,
  toolsToLLMFormat,
} from "./utils";

// Re-export base adapter types for compatibility
export type {
  LLMAdapter,
  LLMConfig,
  LLMMessage,
  LLMResponse,
  LLMStreamResponse,
  LLMTool,
  LLMToolCall,
  LLMUsage,
  LLMCapabilities,
} from "@mcpconnect/base-adapters";
