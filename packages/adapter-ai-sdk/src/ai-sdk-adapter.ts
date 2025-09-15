// packages/adapter-ai-sdk/src/ai-sdk-adapter.ts
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
  MCPToolDefinition,
} from "@mcpconnect/base-adapters";
import {
  Connection,
  Tool,
  ChatMessage,
  ToolExecution,
} from "@mcpconnect/schemas";
import { z } from "zod";
import { MCPService } from "./mcp-service";
import { AnthropicProvider } from "./providers/anthropic";
import { generateText, streamText, LanguageModel } from "ai";

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
 * AI SDK implementation of LLMAdapter with integrated chat and model services
 */
export class AISDKAdapter extends LLMAdapter {
  protected config: AISDKConfig;
  private static storageAdapter: StorageAdapter | null = null;
  private aiModel: LanguageModel | null = null;

  constructor(config: AISDKConfig) {
    const parsedConfig = AISDKConfigSchema.parse(config);
    super(parsedConfig);
    this.config = parsedConfig;
    this.initializeAIModel();
  }

  /**
   * Initialize the AI SDK model based on configuration
   */
  private initializeAIModel() {
    try {
      console.log("Initializing AI model with config:", {
        provider: this.config.provider,
        model: this.config.model,
        hasApiKey: !!this.config.apiKey,
        baseUrl: this.config.baseUrl || "default",
      });

      switch (this.config.provider) {
        case "anthropic": {
          // Use the AnthropicProvider with proper CORS configuration
          const anthropicProvider = AnthropicProvider.createProviderWithCors(
            this.config.apiKey!,
            this.config.baseUrl
          );
          this.aiModel = anthropicProvider(this.config.model);
          console.log(
            "Anthropic model initialized successfully with CORS configuration"
          );
          break;
        }
        default:
          throw new AdapterError(
            `Unsupported provider: ${this.config.provider}`,
            "UNSUPPORTED_PROVIDER"
          );
      }
    } catch (error) {
      console.error("Failed to initialize AI model:", error);
      this.aiModel = null;
    }
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
    console.log("Initializing AISDKAdapter...");

    if (!this.aiModel) {
      this.initializeAIModel();
    }

    if (!this.aiModel) {
      throw new AdapterError(
        `Failed to initialize ${this.config.provider} model`,
        "MODEL_INITIALIZATION_FAILED"
      );
    }

    console.log("Testing connection...");
    const isConnected = await this.testConnection();
    if (!isConnected) {
      throw new AdapterError(
        `Failed to connect to ${this.config.provider} provider`,
        "CONNECTION_FAILED"
      );
    }

    this.status = AdapterStatus.CONNECTED;
    console.log("AISDKAdapter initialized successfully");
  }

  async testConnection(): Promise<boolean> {
    if (!this.aiModel) {
      console.log("testConnection: No AI model available");
      return false;
    }

    try {
      console.log("Testing connection with minimal request...");

      const result = await generateText({
        model: this.aiModel,
        messages: [{ role: "user", content: "Hi" }],
        maxOutputTokens: 1,
      });

      console.log("Connection test successful:", {
        hasText: !!result.text,
        usage: result.usage,
      });

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
    if (!this.aiModel) {
      throw new AdapterError(
        "AI model not initialized",
        "MODEL_NOT_INITIALIZED"
      );
    }

    this.status = AdapterStatus.PROCESSING;

    try {
      const aiMessages = this.convertToAIMessages(messages);
      const tools = this.convertToAITools(options?.tools || this.config.tools);

      console.log("Complete request:", {
        messageCount: aiMessages.length,
        toolCount: Object.keys(tools).length,
        hasTools: Object.keys(tools).length > 0,
      });

      const result = await generateText({
        model: this.aiModel,
        messages: aiMessages,
        tools: Object.keys(tools).length > 0 ? tools : undefined,
        maxOutputTokens: options?.maxTokens || this.config.maxTokens,
        temperature: options?.temperature || this.config.temperature,
      });

      this.status = AdapterStatus.CONNECTED;

      const toolCalls: LLMToolCall[] =
        result.toolCalls?.map(tc => ({
          id: tc.toolCallId,
          type: "function",
          function: {
            name: tc.toolName,
            arguments: JSON.stringify(tc.input),
          },
        })) || [];

      return {
        id: `ai-sdk-${Date.now()}`,
        content: result.text,
        finishReason:
          result.finishReason === "tool-calls" ? "tool_calls" : "stop",
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        model: this.config.model,
        timestamp: new Date(),
        usage: {
          promptTokens: result.usage.inputTokens!,
          completionTokens: result.usage.outputTokens!,
          totalTokens:
            result.usage.totalTokens ??
            result.usage.inputTokens! + result.usage.outputTokens!,
        },
      };
    } catch (error) {
      this.status = AdapterStatus.ERROR;
      this.handleError(error, "complete");
    }
  }

  /**
   * Convert MCP tool definition to internal Tool format
   */
  protected convertMCPToolToTool(mcpTool: MCPToolDefinition): Tool {
    const parameters: Tool["parameters"] = [];

    if (mcpTool.inputSchema?.properties) {
      for (const [name, schema] of Object.entries(
        mcpTool.inputSchema.properties
      )) {
        const isRequired =
          mcpTool.inputSchema.required?.includes(name) || false;
        const paramSchema = schema as any;

        parameters.push({
          name,
          type: this.mapJsonSchemaTypeToParameterType(
            paramSchema.type || "string"
          ),
          description: paramSchema.description || `Parameter ${name}`,
          required: isRequired,
          default: paramSchema.default,
        });
      }
    }

    // Ensure inputSchema always has proper structure for AI SDK
    const inputSchema = {
      ...mcpTool.inputSchema, // Include other properties
      type: "object" as const,
      properties: mcpTool.inputSchema?.properties || {},
      required: mcpTool.inputSchema?.required || [],
    };

    return {
      id: this.generateId(),
      name: mcpTool.name,
      description: mcpTool.description,
      inputSchema, // Use the normalized schema
      parameters,
      category: "mcp",
      tags: ["mcp", "introspected"],
      deprecated: false,
    };
  }

  protected mapJsonSchemaTypeToParameterType(
    jsonType: string
  ): NonNullable<Tool["parameters"]>[0]["type"] {
    switch (jsonType) {
      case "string":
        return "string";
      case "number":
      case "integer":
        return "number";
      case "boolean":
        return "boolean";
      case "object":
        return "object";
      case "array":
        return "array";
      default:
        return "string";
    }
  }

  async *stream(
    messages: LLMMessage[],
    options?: Partial<LLMConfig>
  ): AsyncIterable<LLMStreamResponse> {
    if (!this.aiModel) {
      throw new AdapterError(
        "AI model not initialized",
        "MODEL_NOT_INITIALIZED"
      );
    }

    this.status = AdapterStatus.PROCESSING;

    try {
      const aiMessages = this.convertToAIMessages(messages);
      const tools = this.convertToAITools(options?.tools || this.config.tools);

      console.log("Stream request:", {
        messageCount: aiMessages.length,
        toolCount: Object.keys(tools).length,
        hasTools: Object.keys(tools).length > 0,
      });

      const result = await streamText({
        model: this.aiModel,
        messages: aiMessages,
        tools: Object.keys(tools).length > 0 ? tools : undefined,
        maxOutputTokens: options?.maxTokens || this.config.maxTokens,
        temperature: options?.temperature || this.config.temperature,
      });

      for await (const delta of result.textStream) {
        yield {
          id: `ai-sdk-stream-${Date.now()}`,
          delta: {
            content: delta,
          },
          model: this.config.model,
        };
      }

      // Handle tool calls if any
      const finalResult = await result.finishReason;
      if (finalResult === "tool-calls") {
        const toolCalls = await result.toolCalls;
        for (const toolCall of toolCalls) {
          yield {
            id: `ai-sdk-stream-${Date.now()}`,
            delta: {
              toolCalls: [
                {
                  index: 0,
                  id: toolCall.toolCallId,
                  type: "function",
                  function: {
                    name: toolCall.toolName,
                    arguments: JSON.stringify(toolCall.input),
                  },
                },
              ],
            },
            model: this.config.model,
          };
        }
      }

      const usage = await result.usage;
      yield {
        id: `ai-sdk-stream-${Date.now()}`,
        delta: {},
        finishReason: finalResult === "tool-calls" ? "tool_calls" : "stop",
        model: this.config.model,
        usage: {
          promptTokens: usage.inputTokens!,
          completionTokens: usage.outputTokens!,
          totalTokens:
            usage.totalTokens ?? usage?.inputTokens! + usage?.outputTokens!,
        },
      };

      this.status = AdapterStatus.CONNECTED;
    } catch (error) {
      this.status = AdapterStatus.ERROR;
      this.handleError(error, "stream");
    }
  }

  /**
   * Convert LLM messages to AI SDK format
   */
  private convertToAIMessages(messages: LLMMessage[]) {
    return messages.map(msg => ({
      role: msg.role as any,
      content: msg.content,
      ...(msg.toolCallId && { toolInvocationId: msg.toolCallId }),
      ...(msg.toolCalls && {
        toolInvocations: msg.toolCalls.map(tc => ({
          toolCallId: tc.id,
          toolName: tc.function.name,
          args: JSON.parse(tc.function.arguments),
        })),
      }),
    }));
  }

  /**
   * Convert LLM tools to AI SDK format - FIXED VERSION
   */
  private convertToAITools(tools?: LLMTool[]) {
    if (!tools || tools.length === 0) {
      console.log("No tools to convert");
      return {};
    }

    console.log("Converting tools to AI SDK format:", tools.length);

    const convertedTools = tools.reduce(
      (acc, tool) => {
        if (tool.type === "function") {
          console.log("Converting tool:", tool.function.name);

          // Ensure we have a valid schema structure
          let parameters = tool.function.parameters;

          // If parameters is undefined or null, create a default empty object schema
          if (!parameters) {
            parameters = {
              type: "object",
              properties: {},
              required: [],
            };
          }

          // Ensure the schema has the required "type" field
          if (!parameters.type) {
            parameters = {
              ...parameters,
              type: "object",
            };
          }

          // Ensure properties exists
          if (!parameters.properties) {
            parameters = {
              ...parameters,
              properties: {},
            };
          }

          // Ensure required is an array
          if (!Array.isArray(parameters.required)) {
            parameters = {
              ...parameters,
              required: [],
            };
          }

          console.log("Tool parameters after normalization:", parameters);

          acc[tool.function.name] = {
            description:
              tool.function.description || `Execute ${tool.function.name}`,
            parameters,
            // eslint-disable-next-line no-unused-vars
            execute: async (_args: any) => {
              // This is just a placeholder - actual execution happens via MCP
              return `Tool ${tool.function.name} executed`;
            },
          };

          console.log("Added tool to AI SDK:", tool.function.name);
        }
        return acc;
      },
      {} as Record<string, any>
    );

    console.log("Final converted tools:", Object.keys(convertedTools));
    return convertedTools;
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
    this.aiModel = null;
  }

  /**
   * Send a message with streaming support
   */
  async *sendMessageStream(
    userMessage: string,
    context: ChatContext,
    conversationHistory: ChatMessage[] = []
  ): AsyncIterable<StreamingChatResponse> {
    const { tools, llmSettings } = context;

    // Update configuration and reinitialize if needed
    const needsReinit =
      this.config.apiKey !== llmSettings.apiKey ||
      this.config.model !== llmSettings.model ||
      this.config.baseUrl !== llmSettings.baseUrl;

    if (needsReinit) {
      console.log("LLM settings changed, reinitializing model...");
      this.config.apiKey = llmSettings.apiKey;
      this.config.model = llmSettings.model;
      this.config.baseUrl = llmSettings.baseUrl;
      this.config.temperature = llmSettings.temperature;
      this.config.maxTokens = llmSettings.maxTokens;
      this.initializeAIModel();
    }

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

    // Convert tools to LLM format with proper schema handling
    const llmTools: LLMTool[] = tools.map(tool => {
      console.log("Converting tool for LLM:", tool.name, tool.inputSchema);

      // Ensure the input schema is properly structured
      let inputSchema = tool.inputSchema;

      if (!inputSchema) {
        inputSchema = {
          type: "object",
          properties: {},
          required: [],
        };
      }

      // Ensure required fields are present
      if (!inputSchema.type) {
        inputSchema = { ...inputSchema, type: "object" };
      }

      if (!inputSchema.properties) {
        inputSchema = { ...inputSchema, properties: {} };
      }

      if (!Array.isArray(inputSchema.required)) {
        inputSchema = { ...inputSchema, required: [] };
      }

      const llmTool: LLMTool = {
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: inputSchema,
        },
      };

      console.log("Created LLM tool:", llmTool);
      return llmTool;
    });

    console.log("Setting tools for streaming:", llmTools.length);
    this.config.tools = llmTools;

    let fullContent = "";
    const toolCalls: LLMToolCall[] = [];
    const toolExecutionMessages: ChatMessage[] = [];

    try {
      // Stream the initial response
      for await (const chunk of this.stream(llmMessages)) {
        if (chunk.delta?.content) {
          fullContent += chunk.delta.content;
          yield {
            type: "token",
            delta: chunk.delta.content,
          };
        }

        // Handle tool calls from streaming
        if (chunk.delta?.toolCalls) {
          for (const tc of chunk.delta.toolCalls) {
            if (tc.function?.name && tc.function?.arguments) {
              toolCalls.push({
                id: tc.id || this.generateId(),
                type: "function",
                function: {
                  name: tc.function.name,
                  arguments: tc.function.arguments,
                },
              });
            }
          }
        }
      }

      // Handle tool execution if any
      if (toolCalls.length > 0) {
        console.log(`[AISDKAdapter] Processing ${toolCalls.length} tool calls`);

        for (const toolCall of toolCalls) {
          yield {
            type: "tool_start",
            toolName: toolCall.function.name,
          };

          const toolResult = await this.executeToolWithTracking(
            context.connection,
            toolCall.function.name,
            JSON.parse(toolCall.function.arguments)
          );

          toolExecutionMessages.push(toolResult.chatMessage);

          yield {
            type: "tool_end",
            toolName: toolCall.function.name,
            toolResult: toolResult.result,
            toolExecution: toolResult.toolExecution,
          };
        }

        // Get final response with tool results
        const toolResultMessages: LLMMessage[] = [
          ...llmMessages,
          {
            role: "assistant",
            content: fullContent || "",
            toolCalls: toolCalls,
          },
          ...toolCalls.map(tc => ({
            role: "tool" as const,
            content: "Tool executed successfully",
            toolCallId: tc.id,
          })),
        ];

        let finalContent = "";
        for await (const chunk of this.stream(toolResultMessages)) {
          if (chunk.delta?.content) {
            finalContent += chunk.delta.content;
            yield {
              type: "token",
              delta: chunk.delta.content,
            };
          }
        }
        fullContent = finalContent;
      }

      const assistantMessage: ChatMessage = {
        id: this.generateId(),
        message: fullContent || "I executed the requested tools.",
        isUser: false,
        timestamp: new Date(),
        isExecuting: false,
      };

      yield {
        type: "message_complete",
        assistantMessage,
        toolExecutionMessages,
      };
    } catch (error) {
      console.error("Stream error:", error);
      yield {
        type: "error",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Send a message with chat context and tool execution
   */
  async sendMessage(
    userMessage: string,
    context: ChatContext,
    conversationHistory: ChatMessage[] = []
  ): Promise<ChatResponse> {
    const { tools, llmSettings } = context;

    // Update configuration and reinitialize if needed
    const needsReinit =
      this.config.apiKey !== llmSettings.apiKey ||
      this.config.model !== llmSettings.model ||
      this.config.baseUrl !== llmSettings.baseUrl;

    if (needsReinit) {
      console.log("LLM settings changed, reinitializing model...");
      this.config.apiKey = llmSettings.apiKey;
      this.config.model = llmSettings.model;
      this.config.baseUrl = llmSettings.baseUrl;
      this.config.temperature = llmSettings.temperature;
      this.config.maxTokens = llmSettings.maxTokens;
      this.initializeAIModel();
    }

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

    // Convert tools to LLM format with proper schema handling
    const llmTools: LLMTool[] = tools.map(tool => {
      console.log(
        "Converting tool for LLM (non-streaming):",
        tool.name,
        tool.inputSchema
      );

      // Ensure the input schema is properly structured
      let inputSchema = tool.inputSchema;

      if (!inputSchema) {
        inputSchema = {
          type: "object",
          properties: {},
          required: [],
        };
      }

      // Create a new normalized schema object to avoid mutation
      const normalizedSchema = {
        type: "object" as const, // Ensure type is always "object"
        properties: inputSchema.properties || {},
        required: Array.isArray(inputSchema.required)
          ? inputSchema.required
          : [],
        // Preserve other properties that might be present
        ...(inputSchema.additionalProperties !== undefined && {
          additionalProperties: inputSchema.additionalProperties,
        }),
        ...(inputSchema.description
          ? {
              description: inputSchema.description,
            }
          : {}),
      };

      const llmTool: LLMTool = {
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: normalizedSchema,
        },
      };

      console.log("Created LLM tool (non-streaming):", llmTool);
      return llmTool;
    });

    console.log("Setting tools for completion:", llmTools.length);
    this.config.tools = llmTools;

    // Get initial response
    const response = await this.complete(llmMessages);
    const toolExecutionMessages: ChatMessage[] = [];

    // Handle tool calls if any
    if (response.toolCalls && response.toolCalls.length > 0) {
      console.log(
        `[AISDKAdapter] Processing ${response.toolCalls.length} tool calls`
      );

      for (const toolCall of response.toolCalls) {
        const toolResult = await this.executeToolWithTracking(
          context.connection,
          toolCall.function.name,
          JSON.parse(toolCall.function.arguments)
        );

        toolExecutionMessages.push(toolResult.chatMessage);
      }

      // Get final response with tool results
      const toolResultMessages: LLMMessage[] = [
        ...llmMessages,
        {
          role: "assistant",
          content: response.content || "",
          toolCalls: response.toolCalls,
        },
        ...response.toolCalls.map(tc => ({
          role: "tool" as const,
          content: "Tool executed successfully",
          toolCallId: tc.id,
        })),
      ];

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
   * Execute a tool with tracking
   */
  private async executeToolWithTracking(
    connection: Connection,
    toolName: string,
    toolArgs: Record<string, any>
  ): Promise<ToolExecutionResult> {
    const executionId = this.generateId();
    const startTime = Date.now();

    try {
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
   * Generate unique ID
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
    return AnthropicProvider.getAvailableModels();
  }

  static async testApiKey(apiKey: string, baseUrl?: string): Promise<boolean> {
    return AnthropicProvider.testApiKey(apiKey, baseUrl);
  }

  static validateApiKey(apiKey: string): boolean {
    return AnthropicProvider.validateApiKey(apiKey);
  }

  static getModelPricing(
    model: string
  ): { input: number; output: number } | null {
    return AnthropicProvider.getModelPricing(model);
  }

  static getContextLimit(model: string): number {
    return AnthropicProvider.getContextLimit(model);
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
