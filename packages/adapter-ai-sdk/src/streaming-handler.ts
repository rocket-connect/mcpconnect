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
    {
      role: "user" as const,
      content: userMessage,
    },
  ];

  const llmTools = toolsToLLMFormat(tools);
  let fullContent = "";
  const allToolExecutionMessages: ChatMessage[] = [];
  const currentMessages = [...llmMessages];

  const maxIterations = 5;
  let iteration = 0;

  try {
    while (iteration < maxIterations) {
      iteration++;

      let iterationContent = "";
      const toolCalls: LLMToolCall[] = [];
      let hasToolCalls = false;
      let streamError: Error | null = null;

      try {
        for await (const chunk of adapter.stream(currentMessages, {
          tools: llmTools,
        })) {
          if (chunk.error) {
            streamError = new Error(chunk.error);
            break;
          }

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

          if (chunk.finishReason) {
            break;
          }
        }
      } catch (error) {
        streamError = error instanceof Error ? error : new Error(String(error));
      }

      if (streamError) {
        console.error(
          `[Tool Chain] Stream error in iteration ${iteration}:`,
          streamError
        );
        yield {
          type: "error",
          error: streamError.message,
        };
        return;
      }

      if (iterationContent.trim()) {
        if (hasToolCalls) {
          yield {
            type: "assistant_partial",
            content: iterationContent,
            hasToolCalls: true,
          };
          fullContent += iterationContent;
        } else {
          for (const char of iterationContent) {
            yield {
              type: "token",
              delta: char,
            };
          }
          fullContent += iterationContent;
        }
      }

      if (toolCalls.length === 0) {
        break;
      }

      currentMessages.push({
        role: "assistant",
        content: iterationContent || "",
        toolCalls: toolCalls,
      });

      for (const toolCall of toolCalls) {
        yield {
          type: "tool_start",
          toolName: toolCall.function.name,
        };

        const toolResult = await executeToolWithMCP(
          connection,
          toolCall.function.name,
          JSON.parse(toolCall.function.arguments)
        );

        allToolExecutionMessages.push(toolResult.chatMessage);

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

        const toolMessage = {
          role: "tool" as const,
          content: toolResult.error
            ? JSON.stringify({ error: toolResult.error })
            : JSON.stringify(toolResult.result || { status: "executed" }),
          toolCallId: toolCall.id,
          name: toolCall.function.name,
        };

        currentMessages.push(toolMessage);

        yield {
          type: "tool_end",
          toolName: toolCall.function.name,
          toolResult: toolResult.result,
          toolExecution: toolResult.toolExecution,
        };
      }
    }

    if (allToolExecutionMessages.length > 0) {
      try {
        let finalIterationContent = "";

        for await (const chunk of adapter.stream(currentMessages)) {
          if (chunk.error) {
            break;
          }

          if (chunk.delta?.content) {
            finalIterationContent += chunk.delta.content;
            yield {
              type: "token",
              delta: chunk.delta.content,
            };
          }

          if (chunk.delta?.toolCalls) {
            console.warn("[Final iteration] Unexpected tool calls detected");
            break;
          }

          if (chunk.finishReason === "stop") {
            break;
          }
        }

        fullContent += finalIterationContent;
      } catch (error) {
        console.error("[Final iteration] Error:", error);
      }
    }

    const assistantMessage = createAssistantMessage(fullContent);

    yield {
      type: "message_complete",
      assistantMessage,
      toolExecutionMessages: allToolExecutionMessages,
    };
  } catch (error) {
    console.error("Stream error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    yield {
      type: "error",
      error: errorMessage,
    };
  }
}
