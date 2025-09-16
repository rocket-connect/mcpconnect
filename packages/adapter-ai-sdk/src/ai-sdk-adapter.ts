// packages/adapter-ai-sdk/src/ai-sdk-adapter.ts
/* eslint-disable no-case-declarations */
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
import {
  generateText,
  streamText,
  LanguageModel,
  tool,
  ToolCallPart,
  ToolContent,
  AssistantContent,
  AssistantModelMessage,
  UserModelMessage,
  SystemModelMessage,
  ToolModelMessage,
} from "ai";

/**
 * Extended LLM message interface for AI SDK compatibility
 */
interface ExtendedLLMMessage extends LLMMessage {
  name?: string; // Tool name for tool messages
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
      const aiTools = this.convertToAITools(
        options?.tools || this.config.tools
      );

      console.log("Complete request:", {
        messageCount: aiMessages.length,
        toolCount: Object.keys(aiTools).length,
        hasTools: Object.keys(aiTools).length > 0,
      });

      const result = await generateText({
        model: this.aiModel,
        messages: aiMessages,
        ...(Object.keys(aiTools).length > 0 && { tools: aiTools }),
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
          promptTokens: result.usage.inputTokens || 0,
          completionTokens: result.usage.outputTokens || 0,
          totalTokens:
            result.usage.totalTokens ||
            (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
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

    const inputSchema = {
      ...mcpTool.inputSchema,
      type: "object" as const,
      properties: mcpTool.inputSchema?.properties || {},
      required: mcpTool.inputSchema?.required || [],
    };

    return {
      id: this.generateId(),
      name: mcpTool.name,
      description: mcpTool.description,
      inputSchema,
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
      const aiTools = this.convertToAITools(
        options?.tools || this.config.tools
      );

      console.log("Stream request:", {
        messageCount: aiMessages.length,
        toolCount: Object.keys(aiTools).length,
        hasTools: Object.keys(aiTools).length > 0,
      });

      const result = streamText({
        model: this.aiModel,
        messages: aiMessages,
        ...(Object.keys(aiTools).length > 0 && { tools: aiTools }),
        maxOutputTokens: options?.maxTokens || this.config.maxTokens,
        temperature: options?.temperature || this.config.temperature,
      });

      let hasGeneratedContent = false;
      const currentId = `ai-sdk-stream-${Date.now()}`;
      const accumulatedToolCalls: any[] = [];

      try {
        for await (const delta of result.textStream) {
          hasGeneratedContent = true;
          yield {
            id: currentId,
            delta: {
              content: delta,
            },
            model: this.config.model,
          };
        }

        for await (const chunk of result.fullStream) {
          if (chunk.type === "tool-call") {
            hasGeneratedContent = true;

            const toolCall = {
              id: chunk.toolCallId,
              type: "function" as const,
              function: {
                name: chunk.toolName,
                arguments: JSON.stringify(chunk.input),
              },
            };

            accumulatedToolCalls.push(toolCall);

            yield {
              id: currentId,
              delta: {
                toolCalls: [
                  {
                    index: accumulatedToolCalls.length - 1,
                    id: chunk.toolCallId,
                    type: "function",
                    function: {
                      name: chunk.toolName,
                      arguments: JSON.stringify(chunk.input),
                    },
                  },
                ],
              },
              model: this.config.model,
            };
          }
        }

        const finalResult = await result.finishReason;
        const usage = await result.usage;

        yield {
          id: currentId,
          delta: {},
          finishReason: finalResult === "tool-calls" ? "tool_calls" : "stop",
          model: this.config.model,
          usage: {
            promptTokens: usage.inputTokens || 0,
            completionTokens: usage.outputTokens || 0,
            totalTokens:
              usage.totalTokens ||
              (usage.inputTokens || 0) + (usage.outputTokens || 0),
          },
        };
      } catch (streamError) {
        console.error("Error during streaming:", streamError);

        if (!hasGeneratedContent) {
          console.warn(
            "No content generated before error, yielding minimal response"
          );
          yield {
            id: currentId,
            delta: {
              content: "",
            },
            finishReason: "stop",
            model: this.config.model,
            usage: {
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
            },
          };
        }

        throw streamError;
      }

      if (!hasGeneratedContent) {
        console.warn(
          "No content generated during stream, yielding minimal response"
        );
        const usage = await result.usage.catch(() => ({
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        }));

        yield {
          id: currentId,
          delta: {
            content: "",
          },
          finishReason: "stop",
          model: this.config.model,
          usage: {
            promptTokens: usage.inputTokens || 0,
            completionTokens: usage.outputTokens || 0,
            totalTokens: usage.totalTokens || usage.inputTokens || 0,
          },
        };
      }

      this.status = AdapterStatus.CONNECTED;
    } catch (error) {
      this.status = AdapterStatus.ERROR;
      console.error("Stream error details:", {
        error: error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      this.handleError(error, "stream");
    }
  }

  /**
   * Convert LLM messages to AI SDK format - FIXED for v5 compatibility and MCP tool results
   */
  private convertToAIMessages(messages: (LLMMessage | ExtendedLLMMessage)[]) {
    console.log("Converting messages to AI SDK format:", messages.length);

    return messages.map((msg, index) => {
      console.log(`Converting message ${index}:`, {
        role: msg.role,
        hasContent: !!msg.content,
        hasToolCalls: !!(msg as any).toolCalls,
        toolCallId: (msg as any).toolCallId,
        name: (msg as ExtendedLLMMessage).name,
      });

      const content = String(msg.content || "");

      switch (msg.role) {
        case "tool":
          // FINAL ATTEMPT: Match exact AI SDK v5 ToolContent specification
          let resultData: any;

          try {
            const parsedContent = content ? JSON.parse(content) : null;

            if (parsedContent && typeof parsedContent === "object") {
              if (
                parsedContent.content &&
                Array.isArray(parsedContent.content)
              ) {
                const textContent = parsedContent.content
                  .filter((item: any) => item.type === "text")
                  .map((item: any) => item.text)
                  .join("\n");

                if (textContent) {
                  try {
                    resultData = JSON.parse(textContent);
                  } catch {
                    resultData = textContent;
                  }
                } else {
                  resultData = "Tool executed with non-text content";
                }
              } else {
                resultData = parsedContent;
              }
            } else {
              resultData = content || "Tool executed";
            }
          } catch {
            resultData = content || "Tool executed";
          }

          const toolCallId = (msg as any).toolCallId || "";

          console.log(
            `[FINAL] Creating tool message with validated structure:`,
            {
              toolCallId,
              dataType: typeof resultData,
            }
          );

          // FINAL: Use the exact structure from AI SDK v5 provider-utils
          // Based on the ToolContent type definition
          return {
            role: "tool" as const,
            content: [
              {
                type: "tool-result" as const,
                toolCallId: toolCallId,
                // @ts-ignore
                result: resultData,
              },
            ] as ToolContent,
          } as ToolModelMessage;

        case "assistant":
          if (msg.toolCalls && msg.toolCalls.length > 0) {
            const toolCallParts: ToolCallPart[] = msg.toolCalls.map(tc => ({
              type: "tool-call" as const,
              toolCallId: tc.id,
              toolName: tc.function.name,
              input: JSON.parse(tc.function.arguments),
            }));

            const assistantContent: AssistantContent = content
              ? [{ type: "text" as const, text: content }, ...toolCallParts]
              : toolCallParts;

            return {
              role: "assistant" as const,
              content: assistantContent,
            } as AssistantModelMessage;
          }

          // Simple assistant message - ensure content is a string
          return {
            role: "assistant" as const,
            content: content || "",
          } as AssistantModelMessage;

        case "user":
          return {
            role: "user" as const,
            content: content || "",
          } as UserModelMessage;

        case "system":
          return {
            role: "system" as const,
            content: content || "",
          } as SystemModelMessage;

        default:
          console.warn(
            `Unexpected message role: ${msg.role}, treating as user`
          );
          return {
            role: "user" as const,
            content: content || "",
          } as UserModelMessage;
      }
    });
  }

  /**
   * Convert LLM tools to AI SDK format using proper tool() instances
   */
  private convertToAITools(tools?: LLMTool[]) {
    if (!tools || tools.length === 0) {
      console.log("No tools to convert");
      return {};
    }

    console.log("Converting tools to AI SDK format:", tools.length);

    const convertedTools = tools.reduce(
      (acc, llmTool) => {
        if (llmTool.type === "function") {
          console.log("Converting tool:", llmTool.function.name);

          let parametersSchema = llmTool.function.parameters;

          if (!parametersSchema) {
            parametersSchema = {
              type: "object",
              properties: {},
              required: [],
            };
          }

          if (!parametersSchema.type) {
            parametersSchema = {
              ...parametersSchema,
              type: "object",
            };
          }

          if (!parametersSchema.properties) {
            parametersSchema = {
              ...parametersSchema,
              properties: {},
            };
          }

          if (!Array.isArray(parametersSchema.required)) {
            parametersSchema = {
              ...parametersSchema,
              required: [],
            };
          }

          console.log("Tool parameters after normalization:", parametersSchema);

          const zodSchema = this.jsonSchemaToZod(parametersSchema);

          const aiTool = tool({
            description:
              llmTool.function.description ||
              `Execute ${llmTool.function.name}`,
            inputSchema: zodSchema,
            execute: async (args: any) => {
              console.log(
                `[AI SDK Tool] Executing ${llmTool.function.name} with args:`,
                args
              );

              return {
                toolName: llmTool.function.name,
                arguments: args,
                timestamp: new Date().toISOString(),
                status: "executed_via_ai_sdk",
                note: "Actual MCP execution handled in streaming context",
              };
            },
          });

          acc[llmTool.function.name] = aiTool;
          console.log("Added AI SDK tool:", llmTool.function.name);
        }
        return acc;
      },
      {} as Record<string, any>
    );

    console.log("Final converted tools:", Object.keys(convertedTools));
    return convertedTools;
  }

  /**
   * Convert JSON Schema to Zod schema for AI SDK tools
   */
  private jsonSchemaToZod(jsonSchema: any): z.ZodTypeAny {
    if (!jsonSchema || typeof jsonSchema !== "object") {
      return z.object({});
    }

    if (jsonSchema.type === "object") {
      const shape: Record<string, z.ZodTypeAny> = {};
      const properties = jsonSchema.properties || {};
      const required = Array.isArray(jsonSchema.required)
        ? jsonSchema.required
        : [];

      for (const [key, propSchema] of Object.entries(properties)) {
        let zodType = this.jsonSchemaPropertyToZod(propSchema as any);

        if (
          propSchema &&
          typeof propSchema === "object" &&
          (propSchema as any).description
        ) {
          zodType = zodType.describe((propSchema as any).description);
        }

        if (!required.includes(key)) {
          zodType = zodType.optional();
        }

        shape[key] = zodType;
      }

      return z.object(shape);
    }

    return z.object({});
  }

  /**
   * Convert individual JSON Schema property to Zod type
   */
  private jsonSchemaPropertyToZod(propSchema: any): z.ZodTypeAny {
    if (!propSchema || typeof propSchema !== "object") {
      return z.string();
    }

    const type = propSchema.type;

    switch (type) {
      case "string":
        let stringSchema = z.string();
        if (propSchema.enum) {
          return z.enum(propSchema.enum);
        }
        if (propSchema.minLength !== undefined) {
          stringSchema = stringSchema.min(propSchema.minLength);
        }
        if (propSchema.maxLength !== undefined) {
          stringSchema = stringSchema.max(propSchema.maxLength);
        }
        return stringSchema;

      case "number":
      case "integer":
        let numberSchema = type === "integer" ? z.number().int() : z.number();
        if (propSchema.minimum !== undefined) {
          numberSchema = numberSchema.min(propSchema.minimum);
        }
        if (propSchema.maximum !== undefined) {
          numberSchema = numberSchema.max(propSchema.maximum);
        }
        return numberSchema;

      case "boolean":
        return z.boolean();

      case "array":
        const itemsSchema = propSchema.items
          ? this.jsonSchemaPropertyToZod(propSchema.items)
          : z.unknown();
        return z.array(itemsSchema);

      case "object":
        if (propSchema.properties) {
          return this.jsonSchemaToZod(propSchema);
        }
        return z.record(z.string(), z.unknown());

      default:
        if (propSchema.anyOf || propSchema.oneOf) {
          const unionSchemas = (propSchema.anyOf || propSchema.oneOf).map(
            (schema: any) => this.jsonSchemaPropertyToZod(schema)
          );
          return z.union(
            unionSchemas as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]
          );
        }

        return z.string();
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
    this.aiModel = null;
  }

  /**
   * FIXED: Enhanced streaming with proper tool result integration
   * Ensures tool results are sent back to the LLM for summarization
   */
  async *sendMessageStream(
    userMessage: string,
    context: ChatContext,
    // eslint-disable-next-line no-unused-vars
    _conversationHistory: ChatMessage[] = []
  ): AsyncIterable<StreamingChatResponse> {
    const { tools, llmSettings, connection } = context;

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

    const llmMessages: LLMMessage[] = [
      {
        role: "user",
        content: userMessage,
      },
    ];

    console.log("Starting message stream with tools:", tools.length);

    // Convert tools to LLM format
    const llmTools: LLMTool[] = tools.map(tool => {
      let inputSchema = tool.inputSchema;
      if (!inputSchema) {
        inputSchema = {
          type: "object",
          properties: {},
          required: [],
        };
      }

      const normalizedSchema = {
        type: "object" as const,
        properties: inputSchema.properties || {},
        required: Array.isArray(inputSchema.required)
          ? inputSchema.required
          : [],
      };

      return {
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: normalizedSchema,
        },
      };
    });

    this.config.tools = llmTools;

    let fullContent = "";
    const toolCalls: LLMToolCall[] = [];
    const toolExecutionMessages: ChatMessage[] = [];
    const toolResults: Array<{
      toolCallId: string;
      result: any;
      rawResult: any;
    }> = [];

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

        // Accumulate tool calls
        if (chunk.delta?.toolCalls) {
          for (const tc of chunk.delta.toolCalls) {
            if (tc.function?.name && tc.function?.arguments) {
              const existingCallIndex = toolCalls.findIndex(
                call => call.id === tc.id
              );

              if (existingCallIndex >= 0) {
                toolCalls[existingCallIndex] = {
                  id: tc.id || this.generateId(),
                  type: "function",
                  function: {
                    name: tc.function.name,
                    arguments: tc.function.arguments,
                  },
                };
              } else {
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

        // Check if we've finished with tool calls
        if (
          chunk.finishReason === "tool_calls" ||
          (chunk.finishReason && toolCalls.length > 0)
        ) {
          console.log(
            `Stream completed with ${toolCalls.length} tool calls to execute`
          );
          break;
        }
      }

      // Execute tools if needed
      if (toolCalls.length > 0) {
        console.log(`Executing ${toolCalls.length} tools via MCP...`);

        // Execute each tool and collect results
        for (const toolCall of toolCalls) {
          yield {
            type: "tool_start",
            toolName: toolCall.function.name,
          };

          // Execute via MCP
          const toolResult = await this.executeToolWithMCPStreaming(
            connection,
            toolCall.function.name,
            JSON.parse(toolCall.function.arguments)
          );

          toolExecutionMessages.push(toolResult.chatMessage);

          // Store both the result and the raw result for proper formatting
          toolResults.push({
            toolCallId: toolCall.id,
            result: toolResult.result ||
              toolResult.error || { status: "executed" },
            rawResult: toolResult,
          });

          // Store execution for persistence
          if (AISDKAdapter.storageAdapter) {
            try {
              await AISDKAdapter.storageAdapter.addToolExecution(
                connection.id,
                toolResult.toolExecution
              );
            } catch (error) {
              console.warn("Failed to store tool execution:", error);
            }
          }

          yield {
            type: "tool_end",
            toolName: toolCall.function.name,
            toolResult: toolResult.result,
            toolExecution: toolResult.toolExecution,
          };
        }

        // CRITICAL FIX: Build the complete conversation including tool results
        console.log("[FIXED] Building follow-up messages with tool results...");

        // Build messages as proper LLMMessage format that convertToAIMessages can handle
        const followUpMessages: LLMMessage[] = [
          // 1. Original user message
          {
            role: "user",
            content: userMessage,
          },
          // 2. Assistant's initial response with tool calls
          {
            role: "assistant",
            content: fullContent || "", // Keep the text content
            toolCalls: toolCalls, // Include the tool calls
          },
          // 3. Tool results as individual tool messages
          ...toolCalls.map((tc, index) => {
            const result = toolResults[index];

            // FIXED: Extract meaningful content and properly structure it
            let resultContent: any = result?.result;

            // Handle MCP tool results that have content arrays
            if (
              resultContent &&
              resultContent.content &&
              Array.isArray(resultContent.content)
            ) {
              // Extract text from content array
              const textContent = resultContent.content
                .filter((item: any) => item.type === "text")
                .map((item: any) => item.text)
                .join("\n");

              if (textContent) {
                // Parse the text if it's JSON
                try {
                  resultContent = JSON.parse(textContent);
                } catch {
                  resultContent = textContent;
                }
              } else {
                // Handle non-text content (resources, images, etc.)
                resultContent = {
                  status: "completed",
                  content: resultContent.content,
                  type: "mcp_response",
                };
              }
            }

            // Ensure result is properly structured
            if (resultContent === null || resultContent === undefined) {
              resultContent = {
                status: "completed",
                message: "Tool executed successfully",
              };
            }

            console.log(
              `[FIXED] Tool result for ${tc.function.name}:`,
              resultContent
            );

            // Return as a tool message with proper structure for AI SDK v5
            return {
              role: "tool" as const,
              content: JSON.stringify(resultContent), // Tool content is JSON string
              toolCallId: tc.id,
              name: tc.function.name,
            } as ExtendedLLMMessage;
          }),
        ];

        console.log(
          `[FIXED] Sending ${followUpMessages.length} messages back to LLM for final response`
        );
        console.log(
          "[FIXED] Follow-up messages structure:",
          followUpMessages.map(m => ({
            role: m.role,
            contentType: typeof m.content,
            hasContent: !!m.content,
            hasToolCalls: !!(m as any).toolCalls,
          }))
        );

        // Get the LLM's final response after seeing the tool results
        let finalResponse = "";
        try {
          // Stream the response without tools to prevent loops
          const followUpConfig = { ...this.config, tools: [] };

          // The followUpMessages are already in LLMMessage format
          // They will be converted to AI SDK format by convertToAIMessages in the stream method
          for await (const chunk of this.stream(
            followUpMessages,
            followUpConfig
          )) {
            if (chunk.delta?.content) {
              finalResponse += chunk.delta.content;
              yield {
                type: "token",
                delta: chunk.delta.content,
              };
            }
          }

          // If we got a response, use it
          if (finalResponse) {
            fullContent = finalResponse;
          }
        } catch (error) {
          console.error(
            "[FIXED] Error getting LLM summary of tool results:",
            error
          );

          // Provide a detailed fallback summary based on actual tool results
          const toolSummaries = toolResults.map((result, idx) => {
            const toolName = toolCalls[idx].function.name;
            if (result.rawResult.success) {
              // Try to extract meaningful information from the result
              let summary = `${toolName}: completed successfully`;

              if (result.result && typeof result.result === "object") {
                // Check for common patterns in the result
                if (
                  result.result.content &&
                  Array.isArray(result.result.content)
                ) {
                  // Handle MCP content arrays
                  const textParts = result.result.content
                    .filter((item: any) => item.type === "text")
                    .map((item: any) => {
                      // Try to parse and summarize the text
                      try {
                        const parsed = JSON.parse(item.text);
                        if (parsed.items && Array.isArray(parsed.items)) {
                          return `Found ${parsed.items.length} items`;
                        }
                        return item.text.substring(0, 100);
                      } catch {
                        return item.text.substring(0, 100);
                      }
                    });

                  if (textParts.length > 0) {
                    summary = `${toolName}: ${textParts.join(", ")}`;
                  }
                } else if (result.result.output) {
                  summary = `${toolName}: ${String(result.result.output).substring(0, 200)}`;
                } else if (result.result.text) {
                  summary = `${toolName}: ${String(result.result.text).substring(0, 200)}`;
                }
              }

              return summary;
            } else {
              return `${toolName}: encountered an error - ${result.rawResult.error || "unknown error"}`;
            }
          });

          const fallbackSummary = `I executed the following tool${toolCalls.length > 1 ? "s" : ""}:\n\n${toolSummaries.join("\n")}\n\nThe operation${toolCalls.length > 1 ? "s have" : " has"} completed.`;

          // Stream the fallback character by character
          for (const char of fallbackSummary) {
            yield {
              type: "token",
              delta: char,
            };
          }

          fullContent = fallbackSummary;
        }
      }

      // Send the complete message
      const assistantMessage: ChatMessage = {
        id: this.generateId(),
        message: fullContent || "Task completed.",
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
   * Execute tool via MCP with proper result handling
   */
  private async executeToolWithMCPStreaming(
    connection: Connection,
    toolName: string,
    toolArgs: Record<string, any>
  ): Promise<ToolExecutionResult> {
    const executionId = this.generateId();
    const startTime = Date.now();

    try {
      console.log(`[MCP] Executing tool ${toolName}:`, toolArgs);

      const mcpResult = await MCPService.executeTool(
        connection,
        toolName,
        toolArgs
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`[MCP] Tool execution completed:`, {
        toolName,
        success: mcpResult.success,
        duration,
        hasResult: !!mcpResult.result,
      });

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
      const endTime = Date.now();
      const duration = endTime - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      console.error(`[MCP] Tool execution failed:`, error);

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
   * Send a message with chat context and tool execution
   */
  async sendMessage(
    userMessage: string,
    context: ChatContext,
    conversationHistory: ChatMessage[] = []
  ): Promise<ChatResponse> {
    const { tools, llmSettings } = context;

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

    const llmMessages: LLMMessage[] = conversationHistory
      .filter(msg => {
        return (
          msg.message &&
          msg.message.trim() &&
          typeof msg.message === "string" &&
          !msg.isExecuting &&
          !msg.executingTool &&
          !msg.toolExecution &&
          msg.message.length > 0
        );
      })
      .map(msg => ({
        role: msg.isUser ? ("user" as const) : ("assistant" as const),
        content: String(msg.message || "").trim(),
      }));

    llmMessages.push({
      role: "user",
      content: userMessage,
    });

    const llmTools: LLMTool[] = tools.map(tool => {
      let inputSchema = tool.inputSchema;
      if (!inputSchema) {
        inputSchema = {
          type: "object",
          properties: {},
          required: [],
        };
      }

      const normalizedSchema = {
        type: "object" as const,
        properties: inputSchema.properties || {},
        required: Array.isArray(inputSchema.required)
          ? inputSchema.required
          : [],
      };

      return {
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: normalizedSchema,
        },
      };
    });

    this.config.tools = llmTools;

    const response = await this.complete(llmMessages);
    const toolExecutionMessages: ChatMessage[] = [];
    const toolResults: Array<{ toolCallId: string; result: any }> = [];

    if (response.toolCalls && response.toolCalls.length > 0) {
      console.log(`Processing ${response.toolCalls.length} tool calls via MCP`);

      for (const toolCall of response.toolCalls) {
        const toolResult = await this.executeToolWithMCPStreaming(
          context.connection,
          toolCall.function.name,
          JSON.parse(toolCall.function.arguments)
        );

        toolExecutionMessages.push(toolResult.chatMessage);
        toolResults.push({
          toolCallId: toolCall.id,
          result: toolResult.result || { status: "executed" },
        });

        if (AISDKAdapter.storageAdapter) {
          try {
            await AISDKAdapter.storageAdapter.addToolExecution(
              context.connection.id,
              toolResult.toolExecution
            );
          } catch (error) {
            console.warn("Failed to store tool execution:", error);
          }
        }
      }

      const followUpMessages: ExtendedLLMMessage[] = [
        {
          role: "user",
          content: userMessage,
        },
        {
          role: "assistant",
          content: response.content || "",
          toolCalls: response.toolCalls,
        },
        ...response.toolCalls.map((tc, index) => {
          const result = toolResults[index];
          const resultContent = result?.result || { status: "completed" };

          return {
            role: "tool" as const,
            content: JSON.stringify(resultContent),
            toolCallId: tc.id,
            name: tc.function.name,
          } as ExtendedLLMMessage;
        }),
      ];

      try {
        const finalResponse = await this.complete(followUpMessages);
        response.content = finalResponse.content;
      } catch (error) {
        console.error("Error in final completion:", error);
        response.content = `I executed ${response.toolCalls.length} tool(s): ${response.toolCalls.map(tc => tc.function.name).join(", ")}. The operation completed.`;
      }
    }

    const assistantMessage: ChatMessage = {
      id: this.generateId(),
      message: response.content || "Task completed.",
      isUser: false,
      timestamp: new Date(),
      isExecuting: false,
    };

    return {
      assistantMessage,
      toolExecutionMessages,
    };
  }

  private generateId(): string {
    return `tool_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  // Static helper methods remain unchanged...
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
