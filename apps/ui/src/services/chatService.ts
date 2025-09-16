import { ChatMessage, ToolExecution } from "@mcpconnect/schemas";
import {
  AISDKAdapter,
  ChatContext,
  ChatResponse,
  LLMSettings,
  StreamingChatResponse,
} from "@mcpconnect/adapter-ai-sdk";
import { StorageAdapter } from "@mcpconnect/base-adapters";

// Re-export types for compatibility
export type { ChatContext, ChatResponse, LLMSettings };

// SSE Event interface for streaming (simplified)
export interface SSEEvent {
  type:
    | "thinking"
    | "token"
    | "tool_start"
    | "tool_end"
    | "message_complete"
    | "error";
  data?: {
    delta?: string;
    toolName?: string;
    toolResult?: any;
    toolExecution?: ToolExecution;
    assistantMessage?: ChatMessage;
    toolExecutionMessages?: ChatMessage[];
    error?: string;
  };
}

/**
 * Simplified chat service that delegates all operations to AISDKAdapter
 */
export class ChatService {
  private static adapter: AISDKAdapter | null = null;
  private static storageAdapter: StorageAdapter | null = null;
  private static currentSettings: LLMSettings | null = null;

  /**
   * Set the storage adapter to use
   */
  static setStorageAdapter(adapter: StorageAdapter) {
    this.storageAdapter = adapter;
    AISDKAdapter.setStorageAdapter(adapter);
  }

  /**
   * Initialize or update the adapter with new settings
   */
  private static initializeAdapter(settings: LLMSettings): void {
    if (
      !this.adapter ||
      !this.currentSettings ||
      JSON.stringify(this.currentSettings) !== JSON.stringify(settings)
    ) {
      this.adapter = new AISDKAdapter({
        name: "mcpconnect-chat-adapter",
        provider: settings.provider,
        model: settings.model,
        apiKey: settings.apiKey,
        baseUrl: settings.baseUrl?.trim() || undefined,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        stream: false,
        timeout: 30000,
        retries: 3,
        debug: false,
      });

      this.currentSettings = { ...settings };
    }
  }

  /**
   * Send a message to Claude using AISDKAdapter
   */
  static async sendMessage(
    userMessage: string,
    context: ChatContext,
    conversationHistory: ChatMessage[] = []
  ): Promise<ChatResponse> {
    const { llmSettings } = context;

    if (!llmSettings.apiKey) {
      throw new Error("No Claude API key configured");
    }

    this.initializeAdapter(llmSettings);

    if (!this.adapter) {
      throw new Error("Failed to initialize adapter");
    }

    try {
      const response = await this.adapter.sendMessage(
        userMessage,
        context,
        conversationHistory
      );

      return response;
    } catch (error) {
      console.error("[ChatService] Send message failed:", error);
      throw error;
    }
  }

  /**
   * Send a message with streaming support
   */
  static async sendMessageWithStreaming(
    userMessage: string,
    context: ChatContext,
    conversationHistory: ChatMessage[] = [],
    onEvent: (event: SSEEvent) => Promise<void>
  ): Promise<void> {
    const { llmSettings } = context;

    if (!llmSettings.apiKey) {
      throw new Error("No Claude API key configured");
    }

    this.initializeAdapter(llmSettings);

    if (!this.adapter) {
      throw new Error("Failed to initialize adapter");
    }

    try {
      // Emit thinking event
      await onEvent({
        type: "thinking",
        data: {},
      });

      // Use the adapter's streaming method and convert events
      for await (const streamEvent of this.adapter.sendMessageStream(
        userMessage,
        context,
        conversationHistory
      )) {
        // Convert AISDKAdapter streaming events to our SSE format
        await this.convertAndEmitStreamEvent(streamEvent, onEvent);
      }
    } catch (error) {
      console.error("[ChatService] Streaming message failed:", error);
      await onEvent({
        type: "error",
        data: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  /**
   * Convert AISDKAdapter streaming events to our SSE format
   */
  private static async convertAndEmitStreamEvent(
    streamEvent: StreamingChatResponse,
    onEvent: (event: SSEEvent) => Promise<void>
  ): Promise<void> {
    switch (streamEvent.type) {
      case "token":
        await onEvent({
          type: "token",
          data: {
            delta: streamEvent.delta,
          },
        });
        break;

      case "tool_start":
        await onEvent({
          type: "tool_start",
          data: {
            toolName: streamEvent.toolName,
          },
        });
        break;

      case "tool_end":
        await onEvent({
          type: "tool_end",
          data: {
            toolName: streamEvent.toolName,
            toolResult: streamEvent.toolResult,
            toolExecution: streamEvent.toolExecution,
          },
        });
        break;

      case "message_complete":
        await onEvent({
          type: "message_complete",
          data: {
            assistantMessage: streamEvent.assistantMessage,
            toolExecutionMessages: streamEvent.toolExecutionMessages,
          },
        });
        break;

      case "error":
        await onEvent({
          type: "error",
          data: {
            error: streamEvent.error,
          },
        });
        break;
    }
  }

  /**
   * Store tool execution using the storage adapter
   */
  static async storeToolExecution(
    connectionId: string,
    execution: ToolExecution
  ): Promise<void> {
    if (!this.storageAdapter) {
      console.warn("No storage adapter configured for ChatService");
      return;
    }

    try {
      await this.storageAdapter.addToolExecution(connectionId, execution);
    } catch (error) {
      console.error("Failed to store tool execution:", error);
    }
  }

  // Delegate all static helper methods to AISDKAdapter
  static createPendingToolMessage(toolName: string): ChatMessage {
    return AISDKAdapter.createPendingToolMessage(toolName);
  }

  static createThinkingMessage(): ChatMessage {
    return AISDKAdapter.createThinkingMessage();
  }

  static validateChatContext(context: ChatContext): boolean {
    return AISDKAdapter.validateChatContext(context);
  }

  static getErrorMessage(error: unknown): string {
    return AISDKAdapter.getErrorMessage(error);
  }

  static async testApiKey(apiKey: string, baseUrl?: string): Promise<boolean> {
    return AISDKAdapter.testApiKey(apiKey, baseUrl);
  }

  static validateApiKey(apiKey: string): boolean {
    return AISDKAdapter.validateApiKey(apiKey);
  }

  static getModelPricing(model: string) {
    return AISDKAdapter.getModelPricing(model);
  }

  static getContextLimit(model: string): number {
    return AISDKAdapter.getContextLimit(model);
  }
}
