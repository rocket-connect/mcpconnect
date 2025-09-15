// apps/ui/src/services/chatService.ts - Refactored to use abstract StorageAdapter
import { Connection, ChatMessage, ToolExecution } from "@mcpconnect/schemas";
import {
  AISDKAdapter,
  ChatContext,
  ChatResponse,
} from "@mcpconnect/adapter-ai-sdk";
import { MCPService } from "./mcpService";
import { StorageAdapter } from "@mcpconnect/base-adapters";
import { nanoid } from "nanoid";

// Local interface that matches what the UI needs
interface LLMSettings {
  provider: "anthropic";
  apiKey: string;
  model: string;
  baseUrl?: string;
  temperature: number;
  maxTokens: number;
}

/**
 * Centralized service for chat functionality using AISDKAdapter
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

    // Also set it for the AISDKAdapter to use
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
      console.log("[ChatService] Initializing AISDKAdapter with settings:", {
        provider: settings.provider,
        model: settings.model,
        hasApiKey: !!settings.apiKey,
      });

      // Clean up settings to ensure proper validation
      const cleanSettings = {
        ...settings,
        baseUrl: settings.baseUrl?.trim() || undefined, // Convert empty strings to undefined
      };

      this.adapter = new AISDKAdapter({
        name: "mcpconnect-chat-adapter",
        provider: cleanSettings.provider,
        model: cleanSettings.model,
        apiKey: cleanSettings.apiKey,
        baseUrl: cleanSettings.baseUrl,
        temperature: cleanSettings.temperature,
        maxTokens: cleanSettings.maxTokens,
        stream: false,
        timeout: 30000,
        retries: 3,
        debug: false,
      });

      this.currentSettings = { ...settings };
    }
  }

  /**
   * Send a message to Claude with tool support using AISDKAdapter
   */
  static async sendMessage(
    userMessage: string,
    context: ChatContext,
    conversationHistory: ChatMessage[] = []
  ): Promise<ChatResponse> {
    const { tools, llmSettings } = context;

    if (!llmSettings.apiKey) {
      throw new Error("No Claude API key configured");
    }

    // Initialize adapter with current settings
    this.initializeAdapter(llmSettings);

    if (!this.adapter) {
      throw new Error("Failed to initialize adapter");
    }

    console.log(
      `[ChatService] Sending message with ${tools.length} available tools`
    );

    try {
      // Use the adapter's sendMessage method
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
   * Execute a tool via MCPService and track the execution
   */
  static async executeToolWithTracking(
    connection: Connection,
    toolName: string,
    toolArgs: Record<string, any>
  ) {
    const executionId = nanoid();

    try {
      console.log(`[ChatService] Executing tool: ${toolName}`, toolArgs);

      // Execute via MCPService
      const mcpResult = await MCPService.executeTool(
        connection,
        toolName,
        toolArgs
      );

      // Create success chat message
      const chatMessage: ChatMessage = {
        id: executionId,
        isUser: false,
        executingTool: toolName,
        timestamp: new Date(),
        toolExecution: {
          toolName,
          status: "success",
          result: mcpResult.result,
        },
        isExecuting: false,
      };

      return {
        success: true,
        result: mcpResult.result,
        toolExecution: mcpResult.execution,
        chatMessage,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[ChatService] Tool execution failed:`, error);

      // Create error chat message
      const chatMessage: ChatMessage = {
        id: executionId,
        isUser: false,
        executingTool: toolName,
        timestamp: new Date(),
        toolExecution: {
          toolName,
          status: "error",
          error: errorMessage,
        },
        isExecuting: false,
      };

      // Create error execution object
      const errorExecution: ToolExecution = {
        id: executionId,
        tool: toolName,
        status: "error",
        duration: 0,
        timestamp: new Date().toLocaleTimeString(),
        request: {
          tool: toolName,
          arguments: toolArgs,
          timestamp: new Date().toISOString(),
        },
        error: errorMessage,
      };

      return {
        success: false,
        error: errorMessage,
        toolExecution: errorExecution,
        chatMessage,
      };
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
      console.log(
        `[ChatService] Stored tool execution for ${connectionId}:`,
        execution.id
      );
    } catch (error) {
      console.error("Failed to store tool execution:", error);
    }
  }

  /**
   * Create a pending tool message
   */
  static createPendingToolMessage(toolName: string): ChatMessage {
    return {
      id: nanoid(),
      isUser: false,
      executingTool: toolName,
      timestamp: new Date(),
      toolExecution: {
        toolName,
        status: "pending",
      },
      isExecuting: true,
    };
  }

  /**
   * Create a thinking message for Claude
   */
  static createThinkingMessage(): ChatMessage {
    return {
      id: nanoid(),
      message: "",
      isUser: false,
      timestamp: new Date(),
      isExecuting: true,
    };
  }

  /**
   * Validate chat context
   */
  static validateChatContext(context: ChatContext): boolean {
    return Boolean(
      context.connection &&
        context.llmSettings?.apiKey &&
        Array.isArray(context.tools)
    );
  }

  /**
   * Get error message for chat failures
   */
  static getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      if (error.message.includes("401")) {
        return "Invalid API key. Please check your Claude API settings.";
      }
      if (error.message.includes("429")) {
        return "Rate limit exceeded. Please wait a moment and try again.";
      }
      if (error.message.includes("500")) {
        return "Claude API is experiencing issues. Please try again later.";
      }
      return error.message;
    }
    return "An unexpected error occurred. Please try again.";
  }

  /**
   * Test API key validity
   */
  static async testApiKey(apiKey: string, baseUrl?: string): Promise<boolean> {
    return AISDKAdapter.testApiKey(apiKey, baseUrl);
  }

  /**
   * Validate API key format
   */
  static validateApiKey(apiKey: string): boolean {
    return AISDKAdapter.validateApiKey(apiKey);
  }

  /**
   * Get model pricing information
   */
  static getModelPricing(model: string) {
    return AISDKAdapter.getModelPricing(model);
  }

  /**
   * Get context limit for model
   */
  static getContextLimit(model: string): number {
    return AISDKAdapter.getContextLimit(model);
  }
}
