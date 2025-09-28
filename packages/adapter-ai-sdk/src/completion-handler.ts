// packages/adapter-ai-sdk/src/completion-handler.ts
import { generateText } from "ai";
import {
  LLMMessage,
  LLMResponse,
  LLMToolCall,
  LLMConfig,
  AdapterError,
} from "@mcpconnect/base-adapters";
import { AIModel } from "./types";
import { convertToAIMessages, convertToAITools } from "./utils";

export async function handleCompletion(
  aiModel: AIModel,
  messages: LLMMessage[],
  options: Partial<LLMConfig> & { model: string; tools?: any }
): Promise<LLMResponse> {
  if (!aiModel) {
    throw new AdapterError("AI model not initialized", "MODEL_NOT_INITIALIZED");
  }

  const aiMessages = convertToAIMessages(messages);
  const aiTools = convertToAITools(options?.tools || []);

  const result = await generateText({
    model: aiModel,
    messages: aiMessages,
    ...(Object.keys(aiTools).length > 0 && { tools: aiTools }),
    maxOutputTokens: options?.maxTokens,
    temperature: options?.temperature,
  });

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
    finishReason: result.finishReason === "tool-calls" ? "tool_calls" : "stop",
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    model: options.model,
    timestamp: new Date(),
    usage: {
      promptTokens: result.usage.inputTokens || 0,
      completionTokens: result.usage.outputTokens || 0,
      totalTokens:
        result.usage.totalTokens ||
        (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
    },
  };
}
