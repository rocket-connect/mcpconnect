import { streamText } from "ai";
import {
  LLMStreamResponse,
  LLMToolCall,
  AdapterError,
} from "@mcpconnect/base-adapters";
import {
  ChatMessage,
  Tool,
  ToolSelectionCallbacks,
  ToolSelectionContext,
  ToolSelectionProvider,
  ToolSelectionResult,
} from "@mcpconnect/schemas";
import { AIModel, StreamingChatResponse, ChatContext } from "./types";
import {
  generateId,
  conversationToLLMMessages,
  toolsToLLMFormat,
} from "./utils";
import { executeToolWithMCP } from "./tool-executor";
import { AISDKAdapter } from "./ai-sdk-adapter";

/**
 * Select tools using provider or return all tools
 */
async function selectToolsForPrompt(
  allTools: Tool[],
  prompt: string,
  conversationHistory: ChatMessage[] = [],
  provider?: ToolSelectionProvider,
  options?: {
    maxTools?: number;
    includeHistory?: boolean;
    fallbackToAll?: boolean;
    connectionId?: string;
  },
  callbacks?: ToolSelectionCallbacks
): Promise<Tool[]> {
  // If no provider, return all tools (existing behavior)
  if (!provider) {
    return allTools;
  }

  const startTime = Date.now();
  const maxTools = options?.maxTools;
  const fallbackToAll = options?.fallbackToAll ?? true;

  try {
    // Notify selection start
    callbacks?.onSelectionStart?.({
      prompt,
      totalTools: allTools.length,
      providerId: provider.id,
    });

    // Build selection context
    const context: ToolSelectionContext = {
      prompt,
      conversationHistory: options?.includeHistory
        ? conversationHistory.map(msg => ({
            role: msg.isUser ? ("user" as const) : ("assistant" as const),
            content: msg.message || "",
          }))
        : undefined,
      connectionId: options?.connectionId,
      maxTools,
    };

    // Call provider
    const result: ToolSelectionResult = await provider.selectTools(
      allTools,
      context,
      callbacks
    );

    // Notify completion
    const durationMs = Date.now() - startTime;
    callbacks?.onSelectionComplete?.({
      result,
      selectedCount: result.tools.length,
      totalCount: allTools.length,
      durationMs,
    });

    // Return selected tools
    return result.tools;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    // Notify error
    callbacks?.onSelectionError?.({
      error: err,
      willFallback: fallbackToAll,
    });

    // Fallback behavior
    if (fallbackToAll) {
      callbacks?.onSelectionFallback?.({
        reason: "Provider failed",
        originalError: err,
      });
      return allTools;
    }

    // Re-throw if no fallback
    throw err;
  }
}

export async function* handleStream(
  aiModel: AIModel,
  messages: any[],
  tools: any,
  config: { maxTokens?: number; temperature?: number; model: string }
): AsyncIterable<LLMStreamResponse> {
  const result = streamText({
    model: aiModel,
    messages,
    ...(Object.keys(tools).length > 0 && { tools }),
    maxOutputTokens: config.maxTokens || 16,
    temperature: config.temperature,
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
        model: config.model,
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
          model: config.model,
        };
      }
    }

    const finalResult = await result.finishReason;
    const usage = await result.usage;

    yield {
      id: currentId,
      delta: {},
      finishReason: finalResult === "tool-calls" ? "tool_calls" : "stop",
      model: config.model,
      usage: {
        promptTokens: usage.inputTokens || 0,
        completionTokens: usage.outputTokens || 0,
        totalTokens:
          usage.totalTokens ||
          (usage.inputTokens || 0) + (usage.outputTokens || 0),
      },
    };
  } catch (streamError) {
    console.error("Stream error details:", streamError);

    let errorMessage = "Stream error occurred";
    let errorType = "STREAM_ERROR";

    if (streamError instanceof Error) {
      errorMessage = streamError.message;

      if (errorMessage.includes("overloaded")) {
        errorMessage =
          "Your LLM is experiencing high demand. Please try again in a moment.";
        errorType = "OVERLOADED_ERROR";
      } else if (errorMessage.includes("rate_limit")) {
        errorMessage =
          "Rate limit exceeded. Please wait before sending another message.";
        errorType = "RATE_LIMIT_ERROR";
      } else if (errorMessage.includes("invalid_request")) {
        errorMessage =
          "Invalid request. Please check your message and try again.";
        errorType = "INVALID_REQUEST_ERROR";
      } else if (errorMessage.includes("authentication")) {
        errorMessage =
          "Authentication failed. Please check your API key in settings.";
        errorType = "AUTH_ERROR";
      } else if (errorMessage.includes("permission")) {
        errorMessage =
          "Permission denied. Please check your API key permissions.";
        errorType = "PERMISSION_ERROR";
      } else if (errorMessage.includes("not_found")) {
        errorMessage =
          "Model not found. Please check your model configuration.";
        errorType = "MODEL_NOT_FOUND_ERROR";
      }
    }

    if (!hasGeneratedContent) {
      yield {
        id: currentId,
        delta: {
          content: "",
        },
        finishReason: "error",
        model: config.model,
        error: errorMessage,
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
      };
    }

    throw new AdapterError(errorMessage, errorType, {
      originalError: streamError,
    });
  }
}

export async function* sendMessageStream(
  adapter: AISDKAdapter,
  userMessage: string,
  context: ChatContext,
  conversationHistory: ChatMessage[] = []
): AsyncIterable<StreamingChatResponse> {
  const {
    tools,
    connection,
    toolSelectionProvider,
    toolSelectionOptions,
    toolSelectionCallbacks,
  } = context;

  // Select tools using provider if available
  const selectedTools = await selectToolsForPrompt(
    tools,
    userMessage,
    conversationHistory,
    toolSelectionProvider,
    {
      ...toolSelectionOptions,
      connectionId: connection.id,
    },
    toolSelectionCallbacks
  );

  const llmMessages = [
    ...conversationToLLMMessages(conversationHistory),
    { role: "user" as const, content: userMessage },
  ];

  // Use selected tools instead of all tools
  const llmTools = toolsToLLMFormat(selectedTools);
  let explanationContent = ""; // Content before tool execution
  let finalContent = ""; // Content after tool execution (the real answer)
  const allToolExecutionMessages: ChatMessage[] = [];
  const currentMessages = [...llmMessages];
  const maxIterations = 5;
  let iteration = 0;
  let messageOrderCounter = conversationHistory.length;
  let hasEmittedPartialMessage = false;
  let partialMessageId: string | null = null;

  // Track cumulative token usage across all iterations
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;

  try {
    while (iteration < maxIterations) {
      iteration++;

      let iterationContent = "";
      const toolCalls: LLMToolCall[] = [];
      let hasToolCalls = false;

      // Collect the complete response first
      for await (const chunk of adapter.stream(currentMessages, {
        tools: llmTools,
      })) {
        if (chunk.delta?.content) {
          iterationContent += chunk.delta.content;
        }

        if (chunk.delta?.toolCalls) {
          hasToolCalls = true;
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

        // Capture token usage from each iteration
        if (chunk.usage) {
          totalPromptTokens += chunk.usage.promptTokens;
          totalCompletionTokens += chunk.usage.completionTokens;
        }

        if (chunk.finishReason) break;
      }

      // Handle content based on whether we're before or after tool execution
      if (iteration === 1 && hasToolCalls && !hasEmittedPartialMessage) {
        // First iteration with tools - extract only the explanatory part
        explanationContent = iterationContent;
        partialMessageId = generateId();

        yield {
          type: "assistant_partial",
          content: explanationContent,
          hasToolCalls: true,
          partialMessageId,
          messageOrder: ++messageOrderCounter,
        };
        hasEmittedPartialMessage = true;
      } else if (iteration === 1 && !hasToolCalls) {
        // First iteration without tools - stream the response directly as tokens
        for (const char of iterationContent) {
          yield { type: "token", delta: char };
        }
        finalContent = iterationContent; // Store for final message creation
      } else if (iteration > 1 && !hasToolCalls) {
        // Final iteration without tools - this is the summary/conclusion
        // Stream the final answer directly without accumulating
        for (const char of iterationContent) {
          yield { type: "token", delta: char };
        }
        finalContent = iterationContent; // Store for final message creation
      }

      // Execute tools if any
      if (toolCalls.length > 0) {
        currentMessages.push({
          role: "assistant",
          content: iterationContent || "",
          toolCalls: toolCalls,
        });

        for (const toolCall of toolCalls) {
          yield {
            type: "tool_start",
            toolName: toolCall.function.name,
            messageOrder: ++messageOrderCounter,
          };

          const toolResult = await executeToolWithMCP(
            connection,
            toolCall.function.name,
            JSON.parse(toolCall.function.arguments)
          );

          toolResult.chatMessage.messageOrder = messageOrderCounter;
          allToolExecutionMessages.push(toolResult.chatMessage);

          currentMessages.push({
            role: "tool" as const,
            content: JSON.stringify(
              toolResult.result || { status: "executed" }
            ),
            toolCallId: toolCall.id,
            name: toolCall.function.name,
          });

          yield {
            type: "tool_end",
            toolName: toolCall.function.name,
            toolResult: toolResult.result,
            toolExecution: toolResult.toolExecution,
            messageOrder: messageOrderCounter,
          };
        }
      } else {
        break; // No more tools to execute
      }
    }

    // Create the final message structure
    let assistantMessage: ChatMessage;
    let finalAssistantMessage: ChatMessage | undefined;

    if (hasEmittedPartialMessage && partialMessageId) {
      // Keep the partial message as the explanation only
      assistantMessage = {
        id: partialMessageId,
        message: explanationContent, // Only the explanation
        isUser: false,
        timestamp: new Date(),
        isExecuting: false,
        messageOrder: messageOrderCounter - allToolExecutionMessages.length,
        isPartial: false,
      };

      // Create a separate message for the final answer if there is one
      if (finalContent && finalContent.trim()) {
        finalAssistantMessage = {
          id: generateId(),
          message: finalContent,
          isUser: false,
          timestamp: new Date(),
          isExecuting: false,
          messageOrder: ++messageOrderCounter,
          isPartial: false,
        };
      }
    } else {
      // Create normal message for non-tool responses - use actual content from LLM
      const messageContent = finalContent || explanationContent;
      assistantMessage = {
        id: generateId(),
        message: messageContent || "", // Use actual LLM response, no fallback message
        isUser: false,
        timestamp: new Date(),
        isExecuting: false,
        messageOrder: ++messageOrderCounter,
        isPartial: false,
      };
    }

    yield {
      type: "message_complete",
      assistantMessage,
      toolExecutionMessages: allToolExecutionMessages,
      finalAssistantMessage, // Separate final response message
      usage: {
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens: totalPromptTokens + totalCompletionTokens,
      },
    };
  } catch (error) {
    console.error("Stream error:", error);
    yield {
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
