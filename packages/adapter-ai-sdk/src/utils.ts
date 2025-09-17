import { z } from "zod";
import { tool } from "ai";
import {
  LLMMessage,
  LLMTool,
  MCPToolDefinition,
} from "@mcpconnect/base-adapters";
import { Tool, ChatMessage, ToolExecution } from "@mcpconnect/schemas";
import {
  ExtendedLLMMessage,
  AIModelMessage,
  AIAssistantContent,
  AIToolContent,
  ToolResultForLLM,
  LLMSettings,
  AISDKConfig,
} from "./types";

/**
 * Generate unique ID utility
 */
export function generateId(): string {
  return `tool_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Map JSON Schema types to parameter types utility
 */
export function mapJsonSchemaTypeToParameterType(
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

/**
 * Convert MCP tool definition to internal Tool format utility
 */
export function convertMCPToolToTool(mcpTool: MCPToolDefinition): Tool {
  const parameters: Tool["parameters"] = [];

  if (mcpTool.inputSchema?.properties) {
    for (const [name, schema] of Object.entries(
      mcpTool.inputSchema.properties
    )) {
      const isRequired = mcpTool.inputSchema.required?.includes(name) || false;
      const paramSchema = schema as any;

      parameters.push({
        name,
        type: mapJsonSchemaTypeToParameterType(paramSchema.type || "string"),
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
    id: generateId(),
    name: mcpTool.name,
    description: mcpTool.description,
    inputSchema,
    parameters,
    category: "mcp",
    tags: ["mcp", "introspected"],
    deprecated: false,
  };
}

/**
 * Convert LLM messages to AI SDK format
 */
export function convertToAIMessages(
  messages: (LLMMessage | ExtendedLLMMessage)[]
): AIModelMessage[] {
  return messages.map(msg => {
    const content = String(msg.content || "");

    switch (msg.role) {
      case "tool": {
        let resultData: any;

        try {
          const parsedContent = content ? JSON.parse(content) : null;

          if (parsedContent && typeof parsedContent === "object") {
            if (parsedContent.content && Array.isArray(parsedContent.content)) {
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

        return {
          role: "tool" as const,
          content: [
            {
              type: "tool-result" as const,
              toolCallId: toolCallId,
              // @ts-ignore
              result: resultData,
            },
          ] as AIToolContent,
        };
      }
      case "assistant":
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          const toolCallParts = msg.toolCalls.map(tc => ({
            type: "tool-call" as const,
            toolCallId: tc.id,
            toolName: tc.function.name,
            input: JSON.parse(tc.function.arguments),
          }));

          const assistantContent: AIAssistantContent = content
            ? [{ type: "text" as const, text: content }, ...toolCallParts]
            : toolCallParts;

          return {
            role: "assistant" as const,
            content: assistantContent,
          };
        }

        return {
          role: "assistant" as const,
          content: content || "",
        };

      case "user":
        return {
          role: "user" as const,
          content: content || "",
        };

      case "system":
        return {
          role: "system" as const,
          content: content || "",
        };

      default:
        console.warn(`Unexpected message role: ${msg.role}, treating as user`);
        return {
          role: "user" as const,
          content: content || "",
        };
    }
  });
}

/**
 * Convert LLM tools to AI SDK format using proper tool() instances
 */
export function convertToAITools(tools?: LLMTool[]) {
  if (!tools || tools.length === 0) {
    return {};
  }

  const convertedTools = tools.reduce(
    (acc, llmTool) => {
      if (llmTool.type === "function") {
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

        const zodSchema = jsonSchemaToZod(parametersSchema);

        const aiTool = tool({
          description:
            llmTool.function.description || `Execute ${llmTool.function.name}`,
          inputSchema: zodSchema,
          execute: async (args: any) => {
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
      }
      return acc;
    },
    {} as Record<string, any>
  );

  return convertedTools;
}

/**
 * Convert JSON Schema to Zod schema for AI SDK tools
 */
export function jsonSchemaToZod(jsonSchema: any): z.ZodTypeAny {
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
      let zodType = jsonSchemaPropertyToZod(propSchema as any);

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
export function jsonSchemaPropertyToZod(propSchema: any): z.ZodTypeAny {
  if (!propSchema || typeof propSchema !== "object") {
    return z.string();
  }

  const type = propSchema.type;

  switch (type) {
    case "string": {
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
    }

    case "number":
    case "integer": {
      let numberSchema = type === "integer" ? z.number().int() : z.number();
      if (propSchema.minimum !== undefined) {
        numberSchema = numberSchema.min(propSchema.minimum);
      }
      if (propSchema.maximum !== undefined) {
        numberSchema = numberSchema.max(propSchema.maximum);
      }
      return numberSchema;
    }

    case "boolean":
      return z.boolean();

    case "array": {
      const itemsSchema = propSchema.items
        ? jsonSchemaPropertyToZod(propSchema.items)
        : z.unknown();
      return z.array(itemsSchema);
    }

    case "object":
      if (propSchema.properties) {
        return jsonSchemaToZod(propSchema);
      }
      return z.record(z.string(), z.unknown());

    default:
      if (propSchema.anyOf || propSchema.oneOf) {
        const unionSchemas = (propSchema.anyOf || propSchema.oneOf).map(
          (schema: any) => jsonSchemaPropertyToZod(schema)
        );
        return z.union(
          unionSchemas as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]
        );
      }

      return z.string();
  }
}

/**
 * Check if adapter configuration needs reinitialization
 */
export function needsReinit(
  config: AISDKConfig,
  settings: LLMSettings
): boolean {
  return (
    config.apiKey !== settings.apiKey ||
    config.model !== settings.model ||
    config.baseUrl !== settings.baseUrl
  );
}

/**
 * Update adapter configuration with new settings
 */
export function updateConfigWithSettings(
  config: AISDKConfig,
  settings: LLMSettings
): AISDKConfig {
  return {
    ...config,
    apiKey: settings.apiKey,
    model: settings.model,
    baseUrl: settings.baseUrl,
    temperature: settings.temperature,
    maxTokens: settings.maxTokens,
  };
}

/**
 * Create thinking message utility
 */
export function createThinkingMessage(): ChatMessage {
  return {
    id: Math.random().toString(36).substring(2, 15),
    message: "",
    isUser: false,
    timestamp: new Date(),
    isExecuting: true,
  };
}

/**
 * Create assistant message from content
 */
export function createAssistantMessage(content: string): ChatMessage {
  return {
    id: generateId(),
    message: content || "Task completed.",
    isUser: false,
    timestamp: new Date(),
    isExecuting: false,
  };
}

/**
 * Get error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
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
 * Validate chat context
 */
export function validateChatContext(context: any): boolean {
  return Boolean(
    context.connection &&
      context.llmSettings?.apiKey &&
      Array.isArray(context.tools)
  );
}

/**
 * Format tool result for LLM consumption
 */
export function formatToolResultForLLM(
  toolCallId: string,
  result: any,
  toolName: string
): ExtendedLLMMessage {
  let formattedResult = result || { status: "completed" };

  if (formattedResult.content && Array.isArray(formattedResult.content)) {
    const textContent = formattedResult.content
      .filter((item: any) => item.type === "text")
      .map((item: any) => item.text)
      .join("\n");

    if (textContent) {
      try {
        formattedResult = JSON.parse(textContent);
      } catch {
        formattedResult = textContent;
      }
    }
  }

  return {
    role: "tool" as const,
    content: JSON.stringify(formattedResult),
    toolCallId,
    name: toolName,
  } as ExtendedLLMMessage;
}

/**
 * Create tool execution from args
 */
export function createBaseToolExecution(
  toolName: string,
  toolArgs: Record<string, any>
): Pick<ToolExecution, "id" | "tool" | "status" | "timestamp" | "request"> {
  const executionId = generateId();

  return {
    id: executionId,
    tool: toolName,
    status: "pending",
    timestamp: new Date().toLocaleTimeString(),
    request: {
      tool: toolName,
      arguments: toolArgs,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Convert conversation history to LLM messages
 */
export function conversationToLLMMessages(
  conversationHistory: ChatMessage[]
): LLMMessage[] {
  return conversationHistory
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
}

/**
 * Convert tools to LLM format
 */
export function toolsToLLMFormat(tools: Tool[]): LLMTool[] {
  return tools.map(tool => {
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
      required: Array.isArray(inputSchema.required) ? inputSchema.required : [],
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
}

/**
 * Create fallback summary for tool executions
 */
export function createFallbackToolSummary(
  toolCalls: any[],
  toolResults: ToolResultForLLM[]
): string {
  const toolSummaries = toolResults.map((result, idx) => {
    const toolName = toolCalls[idx].function.name;
    if (result.rawResult.success) {
      let summary = `${toolName}: completed successfully`;

      if (result.result && typeof result.result === "object") {
        if (result.result.content && Array.isArray(result.result.content)) {
          const textParts = result.result.content
            .filter((item: any) => item.type === "text")
            .map((item: any) => {
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

  return `I executed the following tool${toolCalls.length > 1 ? "s" : ""}:\n\n${toolSummaries.join("\n")}\n\nThe operation${toolCalls.length > 1 ? "s have" : " has"} completed.`;
}
