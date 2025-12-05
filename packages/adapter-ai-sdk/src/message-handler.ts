import {
  ChatMessage,
  ToolSelectionCallbacks,
  ToolSelectionContext,
  ToolSelectionProvider,
  ToolSelectionResult,
  Tool,
} from "@mcpconnect/schemas";
import { ChatContext, ChatResponse, ExtendedLLMMessage } from "./types";
import {
  conversationToLLMMessages,
  toolsToLLMFormat,
  formatToolResultForLLM,
  generateId,
} from "./utils";
import { executeToolWithMCP } from "./tool-executor";
import { AISDKAdapter } from "./ai-sdk-adapter";
import { needsReinit, updateConfigWithSettings } from "./model-manager";

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

export async function sendMessage(
  adapter: AISDKAdapter,
  userMessage: string,
  context: ChatContext,
  conversationHistory: ChatMessage[] = []
): Promise<ChatResponse> {
  const {
    tools,
    llmSettings,
    toolSelectionProvider,
    toolSelectionOptions,
    toolSelectionCallbacks,
  } = context;

  // Check if reinitialization is needed
  if (needsReinit(adapter.config, llmSettings)) {
    adapter.config = updateConfigWithSettings(adapter.config, llmSettings);
    adapter.initializeAIModel();
  }

  // Select tools using provider if available
  const selectedTools = await selectToolsForPrompt(
    tools,
    userMessage,
    conversationHistory,
    toolSelectionProvider,
    {
      ...toolSelectionOptions,
      connectionId: context.connection.id,
    },
    toolSelectionCallbacks
  );

  const llmMessages = conversationToLLMMessages(conversationHistory);

  llmMessages.push({
    role: "user",
    content: userMessage,
  });

  // Use selected tools instead of all tools
  const llmTools = toolsToLLMFormat(selectedTools);
  adapter.config.tools = llmTools;

  const response = await adapter.complete(llmMessages);
  const toolExecutionMessages: ChatMessage[] = [];
  const toolResults: Array<{ toolCallId: string; result: any }> = [];

  if (response.toolCalls && response.toolCalls.length > 0) {
    for (const toolCall of response.toolCalls) {
      const toolResult = await executeToolWithMCP(
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
      const finalResponse = await adapter.complete(followUpMessages);
      response.content = finalResponse.content;
    } catch (error) {
      console.error("Error in final completion:", error);
      response.content = `I executed ${response.toolCalls.length} tool(s): ${response.toolCalls.map(tc => tc.function.name).join(", ")}. The operation completed.`;
    }
  }

  const assistantMessage = {
    id: generateId(),
    message: response.content || "", // Use actual response content, empty if none
    isUser: false,
    timestamp: new Date(),
    isExecuting: false,
    isPartial: false,
  };

  return {
    assistantMessage,
    toolExecutionMessages,
  };
}
