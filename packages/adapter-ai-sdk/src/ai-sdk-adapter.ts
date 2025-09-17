/* eslint-disable no-case-declarations */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  LLMAdapter,
  LLMConfig,
  LLMMessage,
  LLMResponse,
  LLMStreamResponse,
  LLMTool,
  LLMToolCall,
  LLMCapabilities,
  AdapterError,
  AdapterStatus,
  StorageAdapter,
} from "@mcpconnect/base-adapters";
import { Connection, ChatMessage, ToolExecution } from "@mcpconnect/schemas";
import { MCPService } from "./mcp-service";
import { AnthropicProvider } from "./providers/anthropic";
import { generateText, streamText } from "ai";
import {
  AISDKConfig,
  AISDKConfigSchema,
  ChatContext,
  ChatResponse,
  StreamingChatResponse,
  ToolExecutionResult,
  LLMSettings,
  ModelOption,
  ExtendedLLMMessage,
  ToolResultForLLM,
  AIModel,
} from "./types";
import {
  generateId,
  convertMCPToolToTool,
  convertToAIMessages,
  convertToAITools,
  needsReinit,
  updateConfigWithSettings,
  createThinkingMessage,
  createAssistantMessage,
  getErrorMessage,
  validateChatContext,
  formatToolResultForLLM,
  conversationToLLMMessages,
  toolsToLLMFormat,
  createFallbackToolSummary,
} from "./utils";

/**
 * AI SDK implementation of LLMAdapter with integrated chat and model services
 */
export class AISDKAdapter extends LLMAdapter {
  protected config: AISDKConfig;
  private static storageAdapter: StorageAdapter | null = null;
  private aiModel: AIModel | null = null;

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
      switch (this.config.provider) {
        case "anthropic": {
          const anthropicProvider = AnthropicProvider.createProviderWithCors(
            this.config.apiKey!,
            this.config.baseUrl
          );
          this.aiModel = anthropicProvider(this.config.model);
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
    if (!this.aiModel) {
      this.initializeAIModel();
    }

    if (!this.aiModel) {
      throw new AdapterError(
        `Failed to initialize ${this.config.provider} model`,
        "MODEL_INITIALIZATION_FAILED"
      );
    }

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
    if (!this.aiModel) {
      return false;
    }

    try {
      await generateText({
        model: this.aiModel,
        messages: [{ role: "user", content: "Hi" }],
        maxOutputTokens: 1,
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
      const aiMessages = convertToAIMessages(messages);
      const aiTools = convertToAITools(options?.tools || this.config.tools);

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

  protected convertMCPToolToTool = convertMCPToolToTool;

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
      const aiMessages = convertToAIMessages(messages);
      const aiTools = convertToAITools(options?.tools || this.config.tools);

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

  async cleanup(): Promise<void> {
    this.status = AdapterStatus.DISCONNECTED;
    this.aiModel = null;
  }

  async *sendMessageStream(
    userMessage: string,
    context: ChatContext,
    // eslint-disable-next-line no-unused-vars
    _conversationHistory: ChatMessage[] = []
  ): AsyncIterable<StreamingChatResponse> {
    const { tools, llmSettings, connection } = context;

    // Update configuration and reinitialize if needed
    if (needsReinit(this.config, llmSettings)) {
      this.config = updateConfigWithSettings(this.config, llmSettings);
      this.initializeAIModel();
    }

    const llmMessages: LLMMessage[] = [
      {
        role: "user",
        content: userMessage,
      },
    ];

    // Convert tools to LLM format
    const llmTools: LLMTool[] = toolsToLLMFormat(tools);

    this.config.tools = llmTools;

    let fullContent = "";
    const toolCalls: LLMToolCall[] = [];
    const toolExecutionMessages: ChatMessage[] = [];
    const toolResults: ToolResultForLLM[] = [];

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
                  id: tc.id || generateId(),
                  type: "function",
                  function: {
                    name: tc.function.name,
                    arguments: tc.function.arguments,
                  },
                };
              } else {
                toolCalls.push({
                  id: tc.id || generateId(),
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
          break;
        }
      }

      // Execute tools if needed
      if (toolCalls.length > 0) {
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
            result: toolResult.result || { status: "executed" },
            rawResult: toolResult,
            error: toolResult.error,
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

        // Build complete conversation with tool results
        // CRITICAL FIX: Structure the conversation properly for AI SDK v5
        const followUpMessages: LLMMessage[] = [
          {
            role: "user",
            content: userMessage,
          },
          {
            role: "assistant",
            content: fullContent || "",
            toolCalls: toolCalls, // Include the tool calls in the assistant message
          },
          // Add tool result messages in the correct format
          ...toolCalls.map((tc, index) => {
            const result = toolResults[index];
            const content = result.error
              ? JSON.stringify({ error: result.error })
              : JSON.stringify(result.result || { status: "executed" });

            return {
              role: "tool" as const,
              content,
              toolCallId: tc.id,
              name: tc.function.name,
            };
          }),
        ];

        console.log(
          "Follow-up messages for AI SDK:",
          JSON.stringify(followUpMessages, null, 2)
        );

        // Convert to AI SDK format
        const aiMessages = convertToAIMessages(followUpMessages);

        console.log(
          "Converted AI messages:",
          JSON.stringify(aiMessages, null, 2)
        );

        // Get the LLM's final response after seeing the tool results
        let finalResponse = "";
        try {
          // Stream the response without tools to prevent loops
          const followUpConfig = { ...this.config, tools: [] };

          console.log("Sending follow-up with tool results:", {
            messageCount: followUpMessages.length,
            hasToolResults: followUpMessages.some(m => m.role === "tool"),
            toolResultsPreview: followUpMessages
              .filter(m => m.role === "tool")
              .map(m => ({
                toolCallId: (m as any).toolCallId,
                contentLength: m.content?.length,
              })),
          });

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
          console.error("Error getting LLM summary of tool results:", error);

          // Provide a detailed fallback summary based on actual tool results
          const fallbackSummary = createFallbackToolSummary(
            toolCalls,
            toolResults
          );

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
      const assistantMessage = createAssistantMessage(fullContent);

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
    const executionId = generateId();
    const startTime = Date.now();

    try {
      const mcpResult = await MCPService.executeTool(
        connection,
        toolName,
        toolArgs
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Extract the actual data from MCP response structure
      let cleanResult = mcpResult.result;

      // Handle MCP content array structure
      // @ts-ignore
      if (
        cleanResult &&
        // @ts-ignore
        cleanResult.content &&
        // @ts-ignore
        Array.isArray(cleanResult.content)
      ) {
        // @ts-ignore
        const textContent = cleanResult.content
          .filter((item: any) => item.type === "text")
          .map((item: any) => item.text)
          .join("\n");

        if (textContent) {
          try {
            // Parse the JSON string to get the actual campaign data
            cleanResult = JSON.parse(textContent);
          } catch {
            cleanResult = textContent;
          }
        }
      }

      const chatMessage: ChatMessage = {
        id: executionId,
        isUser: false,
        executingTool: toolName,
        timestamp: new Date(),
        toolExecution: {
          toolName,
          status: mcpResult.success ? "success" : "error",
          result: cleanResult,
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
              result: cleanResult,
              timestamp: new Date().toISOString(),
            }
          : undefined,
        error: mcpResult.error,
      };

      return {
        success: mcpResult.success,
        result: cleanResult,
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

    if (needsReinit(this.config, llmSettings)) {
      this.config = updateConfigWithSettings(this.config, llmSettings);
      this.initializeAIModel();
    }

    const llmMessages: LLMMessage[] =
      conversationToLLMMessages(conversationHistory);

    llmMessages.push({
      role: "user",
      content: userMessage,
    });

    const llmTools: LLMTool[] = toolsToLLMFormat(tools);

    this.config.tools = llmTools;

    const response = await this.complete(llmMessages);
    const toolExecutionMessages: ChatMessage[] = [];
    const toolResults: Array<{ toolCallId: string; result: any }> = [];

    if (response.toolCalls && response.toolCalls.length > 0) {
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

      // Add tool results to conversation for final summary
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
        // Include tool results so LLM can summarize
        ...response.toolCalls.map((tc, index) => {
          const result = toolResults[index];
          return formatToolResultForLLM(tc.id, result.result, tc.function.name);
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

    const assistantMessage = createAssistantMessage(
      response.content || "Task completed."
    );

    return {
      assistantMessage,
      toolExecutionMessages,
    };
  }

  // Static helper methods
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

  static createThinkingMessage = createThinkingMessage;
  static validateChatContext = validateChatContext;
  static getErrorMessage = getErrorMessage;

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
    } catch (error) {
      console.error("Failed to store tool execution:", error);
    }
  }
}
