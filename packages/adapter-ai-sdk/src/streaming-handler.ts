// packages/adapter-ai-sdk/src/streaming-handler.ts
import { streamText } from "ai";
import {
  LLMStreamResponse,
  LLMToolCall,
  AdapterError,
} from "@mcpconnect/base-adapters";
import { ChatMessage } from "@mcpconnect/schemas";
import { AIModel, StreamingChatResponse, ChatContext } from "./types";
import {
  generateId,
  conversationToLLMMessages,
  toolsToLLMFormat,
  createAssistantMessage,
} from "./utils";
import { executeToolWithMCP } from "./tool-executor";
import { AISDKAdapter } from "./ai-sdk-adapter";

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
    maxOutputTokens: config.maxTokens,
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
  const { tools, connection } = context;
  const llmMessages = [
    ...conversationToLLMMessages(conversationHistory),
    { role: "user" as const, content: userMessage },
  ];

  const llmTools = toolsToLLMFormat(tools);
  let explanationContent = ""; // Content before tool execution
  let finalContent = ""; // Content after tool execution (the real answer)
  const allToolExecutionMessages: ChatMessage[] = [];
  const currentMessages = [...llmMessages];
  const maxIterations = 5;
  let iteration = 0;
  let messageOrderCounter = conversationHistory.length;
  let hasEmittedPartialMessage = false;
  let partialMessageId: string | null = null;

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
      } else if (iteration > 1 && !hasToolCalls) {
        // FIXED: Final iteration without tools - this is the summary/conclusion
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
        finalAssistantMessage = createAssistantMessage(finalContent);
        finalAssistantMessage.messageOrder = ++messageOrderCounter;
      }
    } else {
      // Create normal message for non-tool responses
      assistantMessage = createAssistantMessage(
        finalContent || explanationContent
      );
      assistantMessage.messageOrder = ++messageOrderCounter;
    }

    yield {
      type: "message_complete",
      assistantMessage,
      toolExecutionMessages: allToolExecutionMessages,
      finalAssistantMessage, // Separate final response message
    };
  } catch (error) {
    console.error("Stream error:", error);
    yield {
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
