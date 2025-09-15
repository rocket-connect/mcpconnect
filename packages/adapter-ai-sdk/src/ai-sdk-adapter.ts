/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  LLMAdapter,
  LLMConfigSchema,
  LLMConfig,
  LLMMessage,
  LLMResponse,
  LLMStreamResponse,
  LLMTool,
  LLMToolCall,
  LLMToolResult,
  LLMUsage,
  LLMCapabilities,
  AdapterError,
  AdapterStatus,
  StorageAdapter,
} from "@mcpconnect/base-adapters";
import {
  Connection,
  Tool,
  ChatMessage,
  ToolExecution,
} from "@mcpconnect/schemas";
import { z } from "zod";
import { MCPService } from "./mcp-service";

/**
 * AI SDK-specific configuration schema
 */
export const AISDKConfigSchema = LLMConfigSchema.extend({
  provider: z.enum(["anthropic"]),
  modelProvider: z.unknown().optional(),
  customProvider: z
    .object({
      generateText: z.function().optional(),
      streamText: z.function().optional(),
      generateObject: z.function().optional(),
    })
    .optional(),
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
 * AI SDK implementation of LLMAdapter with integrated chat and model services
 */
export class AISDKAdapter extends LLMAdapter {
  protected config: AISDKConfig;
  private static storageAdapter: StorageAdapter | null = null;

  constructor(config: AISDKConfig) {
    const parsedConfig = AISDKConfigSchema.parse(config);
    super(parsedConfig);
    this.config = parsedConfig;
  }

  /**
   * Set the storage adapter for static methods
   */
  static setStorageAdapter(adapter: StorageAdapter) {
    this.storageAdapter = adapter;
  }

  async getCapabilities(): Promise<LLMCapabilities> {
    const baseCapabilities: LLMCapabilities = {
      streaming: true,
      tools: true,
      systemMessages: true,
      multiModal: false,
      maxContextLength: 4096,
      supportedModalities: ["text"],
    };

    switch (this.config.provider) {
      case "anthropic":
        return {
          ...baseCapabilities,
          maxContextLength: 200000,
          multiModal: true,
          supportedModalities: ["text", "image"],
          costPerToken: {
            input: 0.000008,
            output: 0.000024,
          },
        };
      default:
        return baseCapabilities;
    }
  }

  async initialize(): Promise<void> {
    const isConnected = await this.testConnection();
    if (!isConnected) {
      throw new AdapterError(
        `Failed to connect to ${this.config.provider} provider`,
        "CONNECTION_FAILED"
      );
    }
    this.status = AdapterStatus.CONNECTED;
  }

  async testConnection(): Promise<boolean> {
    try {
      const testMessages: LLMMessage[] = [{ role: "user", content: "Hello" }];
      await this.complete(testMessages);
      return true;
    } catch (error) {
      console.error("Connection test failed:", error);
      return false;
    }
  }

  async complete(
    messages: LLMMessage[],
    options?: Partial<LLMConfig>
  ): Promise<LLMResponse> {
    this.status = AdapterStatus.PROCESSING;

    try {
      const response = await this.callAnthropicAPI(messages, options);
      this.status = AdapterStatus.CONNECTED;
      return response;
    } catch (error) {
      this.status = AdapterStatus.ERROR;
      this.handleError(error, "complete");
    }
  }

  async *stream(
    messages: LLMMessage[],
    options?: Partial<LLMConfig>
  ): AsyncIterable<LLMStreamResponse> {
    this.status = AdapterStatus.PROCESSING;

    try {
      // This would implement streaming for Anthropic API
      const response = await this.callAnthropicAPI(messages, options);

      // Simulate streaming by yielding the complete response
      yield {
        id: response.id,
        delta: {
          content: response.content,
        },
        finishReason: response.finishReason,
        model: response.model,
        usage: response.usage,
      };

      this.status = AdapterStatus.CONNECTED;
    } catch (error) {
      this.status = AdapterStatus.ERROR;
      this.handleError(error, "stream");
    }
  }

  async executeToolCalls(toolCalls: LLMToolCall[]): Promise<LLMToolResult[]> {
    const results: LLMToolResult[] = [];

    for (const toolCall of toolCalls) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        const mockResult = {
          toolName: toolCall.function.name,
          arguments: args,
          result: `Mock result for ${toolCall.function.name}`,
          executedAt: new Date().toISOString(),
        };

        results.push({
          toolCallId: toolCall.id,
          result: mockResult,
        });
      } catch (error) {
        results.push({
          toolCallId: toolCall.id,
          result: null,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  async estimateTokens(messages: LLMMessage[]): Promise<number> {
    const totalChars = messages.reduce(
      (total, msg) => total + msg.content.length,
      0
    );
    return Math.ceil(totalChars / 4);
  }

  async calculateCost(usage: LLMUsage): Promise<number> {
    const capabilities = await this.getCapabilities();
    if (!capabilities.costPerToken) return 0;

    const inputCost = usage.promptTokens * capabilities.costPerToken.input;
    const outputCost =
      usage.completionTokens * capabilities.costPerToken.output;
    return inputCost + outputCost;
  }

  async cleanup(): Promise<void> {
    this.status = AdapterStatus.DISCONNECTED;
  }

  /**
   * Call Anthropic API directly - FIXED to properly handle tool messages and generate IDs
   */
  private async callAnthropicAPI(
    messages: LLMMessage[],
    options?: Partial<LLMConfig>
  ): Promise<LLMResponse> {
    if (!this.config.apiKey) {
      throw new AdapterError("No API key configured", "MISSING_API_KEY");
    }

    // Convert messages to Claude format, handling tool messages properly
    const claudeMessages: Array<{
      role: "user" | "assistant";
      content:
        | string
        | Array<{
            type: string;
            text?: string;
            tool_call_id?: string;
            tool_use_id?: string;
            content?: string;
            name?: string;
            input?: any;
            id?: string; // FIXED: Added id field for tool_use
          }>;
    }> = [];

    let currentMessage: { role: "user" | "assistant"; content: any[] } | null =
      null;

    for (const msg of messages) {
      if (msg.role === "tool") {
        // FIXED: Tool result messages MUST always be in user messages
        // Finish current message first if it exists
        if (currentMessage) {
          if (
            currentMessage.content.length === 1 &&
            currentMessage.content[0].type === "text"
          ) {
            claudeMessages.push({
              role: currentMessage.role,
              content: currentMessage.content[0].text || "",
            });
          } else {
            claudeMessages.push({
              role: currentMessage.role,
              content: currentMessage.content,
            });
          }
          currentMessage = null;
        }

        // Always create a new user message for tool results
        claudeMessages.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: msg.toolCallId,
              content: msg.content,
            },
          ],
        });
      } else {
        // Finish current message if exists
        if (currentMessage) {
          if (
            currentMessage.content.length === 1 &&
            currentMessage.content[0].type === "text"
          ) {
            claudeMessages.push({
              role: currentMessage.role,
              content: currentMessage.content[0].text || "",
            });
          } else {
            claudeMessages.push({
              role: currentMessage.role,
              content: currentMessage.content,
            });
          }
        }

        // Start new message
        const role = msg.role as "user" | "assistant";
        currentMessage = {
          role,
          content: [{ type: "text", text: msg.content }],
        };

        // Add tool calls if this is an assistant message with tool calls
        if (msg.role === "assistant" && msg.toolCalls) {
          for (const toolCall of msg.toolCalls) {
            currentMessage.content.push({
              type: "tool_use",
              id: toolCall.id, // FIXED: Use the existing tool call ID
              name: toolCall.function.name,
              input: JSON.parse(toolCall.function.arguments),
            });
          }
        }
      }
    }

    // Finish last message
    if (currentMessage) {
      if (
        currentMessage.content.length === 1 &&
        currentMessage.content[0].type === "text"
      ) {
        claudeMessages.push({
          role: currentMessage.role,
          content: currentMessage.content[0].text || "",
        });
      } else {
        claudeMessages.push({
          role: currentMessage.role,
          content: currentMessage.content,
        });
      }
    }

    const claudeTools = this.config.tools?.map(tool => ({
      name: tool.function.name,
      description: tool.function.description,
      input_schema: tool.function.parameters || {
        type: "object",
        properties: {},
        required: [],
      },
    }));

    const requestBody = {
      model: options?.model || this.config.model,
      max_tokens: options?.maxTokens || this.config.maxTokens,
      temperature: options?.temperature || this.config.temperature,
      messages: claudeMessages,
      ...(claudeTools && claudeTools.length > 0 && { tools: claudeTools }),
    };

    console.log(
      "[AISDKAdapter] Sending request to Anthropic:",
      JSON.stringify(requestBody, null, 2)
    );

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
        "x-api-key": this.config.apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new AdapterError(
        `Anthropic API request failed: ${response.status} ${response.statusText}: ${errorText}`,
        "API_REQUEST_FAILED"
      );
    }

    const data = await response.json();
    console.log("[AISDKAdapter] Received response from Anthropic:", data);

    const responseText =
      data.content?.find((c: any) => c.type === "text")?.text || "";
    const toolCalls: LLMToolCall[] = [];

    // Process tool calls if any - FIXED: Ensure proper ID handling
    for (const content of data.content || []) {
      if (content.type === "tool_use") {
        toolCalls.push({
          id: content.id || this.generateId(), // FIXED: Ensure ID is always present
          type: "function",
          function: {
            name: content.name,
            arguments: JSON.stringify(content.input),
          },
        });
      }
    }

    return {
      id: `anthropic-${Date.now()}`,
      content: responseText,
      finishReason:
        data.stop_reason === "end_turn"
          ? "stop"
          : data.stop_reason === "tool_use"
            ? "tool_calls"
            : "stop",
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      model: this.config.model,
      timestamp: new Date(),
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens:
          (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      },
    };
  }

  /**
   * Send a message with chat context and tool execution - FIXED VERSION
   */
  async sendMessage(
    userMessage: string,
    context: ChatContext,
    conversationHistory: ChatMessage[] = []
  ): Promise<ChatResponse> {
    const { tools, llmSettings } = context;

    // Convert conversation history to LLM format
    const llmMessages: LLMMessage[] = conversationHistory
      .filter(
        msg =>
          msg.message &&
          msg.message.trim() &&
          !msg.executingTool &&
          !msg.toolExecution
      )
      .map(msg => ({
        role: msg.isUser ? "user" : "assistant",
        content: msg.message || "",
      }));

    // Add the new user message
    llmMessages.push({
      role: "user",
      content: userMessage,
    });

    // Convert tools to LLM format
    const llmTools: LLMTool[] = tools.map(tool => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema || {
          type: "object",
          properties: {},
          required: [],
        },
      },
    }));

    // Configure adapter for this request
    this.config.apiKey = llmSettings.apiKey;
    this.config.model = llmSettings.model;
    this.config.temperature = llmSettings.temperature;
    this.config.maxTokens = llmSettings.maxTokens;
    this.config.tools = llmTools;

    // Get initial response from Claude
    const response = await this.complete(llmMessages);
    const toolExecutionMessages: ChatMessage[] = [];

    // Handle tool calls if any
    if (response.toolCalls && response.toolCalls.length > 0) {
      console.log(
        `[AISDKAdapter] Processing ${response.toolCalls.length} tool calls`
      );

      // Execute each tool and collect results
      const toolResults: Array<{
        toolCallId: string;
        result: any;
        error?: string;
      }> = [];

      for (const toolCall of response.toolCalls) {
        const toolResult = await this.executeToolWithTracking(
          context.connection,
          toolCall.function.name,
          JSON.parse(toolCall.function.arguments)
        );

        toolExecutionMessages.push(toolResult.chatMessage);

        // Collect result for feeding back to Claude
        toolResults.push({
          toolCallId: toolCall.id,
          result: toolResult.success ? toolResult.result : null,
          error: toolResult.error,
        });
      }

      // Create tool result messages for Claude
      const toolResultMessages: LLMMessage[] = [
        ...llmMessages,
        {
          role: "assistant",
          content: response.content || "",
          toolCalls: response.toolCalls,
        },
        // Add tool results back to Claude
        ...toolResults.map(result => ({
          role: "tool" as const,
          content: result.error
            ? `Error: ${result.error}`
            : typeof result.result === "string"
              ? result.result
              : JSON.stringify(result.result),
          toolCallId: result.toolCallId,
        })),
      ];

      // Get final response from Claude with tool results
      console.log(
        "[AISDKAdapter] Getting final response from Claude with tool results"
      );
      const finalResponse = await this.complete(toolResultMessages);
      response.content = finalResponse.content;
    }

    const assistantMessage: ChatMessage = {
      id: this.generateId(),
      message: response.content || "I executed the requested tools.",
      isUser: false,
      timestamp: new Date(),
      isExecuting: false,
    };

    return {
      assistantMessage,
      toolExecutionMessages,
    };
  }

  /**
   * Execute a tool with tracking - FIXED VERSION
   */
  private async executeToolWithTracking(
    connection: Connection,
    toolName: string,
    toolArgs: Record<string, any>
  ): Promise<ToolExecutionResult> {
    const executionId = this.generateId();
    const startTime = Date.now();

    try {
      // Execute the tool via MCP protocol
      console.log(
        `[AISDKAdapter] Executing tool ${toolName} via MCP:`,
        toolArgs
      );
      const mcpResult = await MCPService.executeTool(
        connection,
        toolName,
        toolArgs
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Use the actual MCP result instead of mock
      const chatMessage: ChatMessage = {
        id: executionId,
        isUser: false,
        executingTool: toolName,
        timestamp: new Date(),
        toolExecution: {
          toolName,
          status: mcpResult.success ? "success" : "error",
          result: mcpResult.result,
          error: mcpResult.error,
        },
        isExecuting: false,
      };

      const toolExecution: ToolExecution = {
        id: executionId,
        tool: toolName,
        status: mcpResult.success ? "success" : "error",
        duration,
        timestamp: new Date().toLocaleTimeString(),
        request: {
          tool: toolName,
          arguments: toolArgs,
          timestamp: new Date().toISOString(),
        },
        response: mcpResult.success
          ? {
              success: true,
              result: mcpResult.result,
              timestamp: new Date().toISOString(),
            }
          : undefined,
        error: mcpResult.error,
      };

      return {
        success: mcpResult.success,
        result: mcpResult.result,
        error: mcpResult.error,
        toolExecution,
        chatMessage,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.error(`[AISDKAdapter] Tool execution failed:`, error);

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

      const errorExecution: ToolExecution = {
        id: executionId,
        tool: toolName,
        status: "error",
        duration,
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
   * Generate unique ID - FIXED to be more robust
   */
  private generateId(): string {
    return `tool_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Static methods for model management
   */
  static getDefaultSettings(): Partial<LLMSettings> {
    return {
      provider: "anthropic",
      model: "claude-3-5-sonnet-20241022",
      temperature: 0.7,
      maxTokens: 4096,
    };
  }

  static getAvailableModels(): ModelOption[] {
    return [
      {
        value: "claude-3-5-sonnet-20241022",
        label: "Claude 3.5 Sonnet",
        description: "Most capable model for complex tasks",
      },
      {
        value: "claude-3-5-haiku-20241022",
        label: "Claude 3.5 Haiku",
        description: "Fast and efficient for simple tasks",
      },
      {
        value: "claude-3-opus-20240229",
        label: "Claude 3 Opus",
        description: "Powerful model for demanding tasks",
      },
      {
        value: "claude-3-sonnet-20240229",
        label: "Claude 3 Sonnet",
        description: "Balanced performance and speed",
      },
      {
        value: "claude-3-haiku-20240307",
        label: "Claude 3 Haiku",
        description: "Quick responses for simple tasks",
      },
    ];
  }

  static async testApiKey(apiKey: string, baseUrl?: string): Promise<boolean> {
    try {
      const url = baseUrl || "https://api.anthropic.com/v1/messages";

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 1,
          messages: [{ role: "user", content: "Hi" }],
        }),
      });

      return response.status !== 401;
    } catch (error) {
      console.error("API key test failed:", error);
      return false;
    }
  }

  static validateApiKey(apiKey: string): boolean {
    return apiKey.startsWith("sk-ant-") && apiKey.length > 20;
  }

  static getModelPricing(
    model: string
  ): { input: number; output: number } | null {
    const pricing: Record<string, { input: number; output: number }> = {
      "claude-3-5-sonnet-20241022": { input: 3, output: 15 },
      "claude-3-5-haiku-20241022": { input: 0.25, output: 1.25 },
      "claude-3-opus-20240229": { input: 15, output: 75 },
      "claude-3-sonnet-20240229": { input: 3, output: 15 },
      "claude-3-haiku-20240307": { input: 0.25, output: 1.25 },
    };
    return pricing[model] || null;
  }

  static getContextLimit(model: string): number {
    const limits: Record<string, number> = {
      "claude-3-5-sonnet-20241022": 200000,
      "claude-3-5-haiku-20241022": 200000,
      "claude-3-opus-20240229": 200000,
      "claude-3-sonnet-20240229": 200000,
      "claude-3-haiku-20240307": 200000,
    };
    return limits[model] || 200000;
  }

  static getApiKeyPlaceholder(): string {
    return "sk-ant-api03-...";
  }

  static getProviderDisplayName(): string {
    return "Anthropic";
  }

  static createPendingToolMessage(toolName: string): ChatMessage {
    return {
      id: Math.random().toString(36).substring(2, 15),
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

  static createThinkingMessage(): ChatMessage {
    return {
      id: Math.random().toString(36).substring(2, 15),
      message: "",
      isUser: false,
      timestamp: new Date(),
      isExecuting: true,
    };
  }

  static validateChatContext(context: ChatContext): boolean {
    return Boolean(
      context.connection &&
        context.llmSettings?.apiKey &&
        Array.isArray(context.tools)
    );
  }

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
   * Store tool execution using the storage adapter
   */
  static async storeToolExecution(
    connectionId: string,
    execution: ToolExecution
  ): Promise<void> {
    if (!this.storageAdapter) {
      console.warn("No storage adapter configured for AISDKAdapter");
      return;
    }

    try {
      await this.storageAdapter.addToolExecution(connectionId, execution);
      console.log(
        `[AISDKAdapter] Stored tool execution for ${connectionId}:`,
        execution.id
      );
    } catch (error) {
      console.error("Failed to store tool execution:", error);
    }
  }
}
