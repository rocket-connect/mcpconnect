import { z } from "zod";
import { tool } from "ai";
import {
  LLMMessage,
  LLMTool,
  MCPToolDefinition,
} from "@mcpconnect/base-adapters";
import { Tool, ChatMessage } from "@mcpconnect/schemas";
import { ExtendedLLMMessage, AIModelMessage } from "./types";

export function generateId(): string {
  return `tool_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

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

export function convertToAIMessages(
  messages: (LLMMessage | ExtendedLLMMessage)[]
): AIModelMessage[] {
  return messages.map(msg => {
    const content = String(msg.content || "");

    switch (msg.role) {
      case "tool": {
        const toolCallId = (msg as any).toolCallId || generateId();
        const toolName = (msg as any).name || "unknown";

        let resultData: any;
        try {
          // If content is a string, try to parse it as JSON
          if (typeof content === "string") {
            resultData = JSON.parse(content);
          } else {
            resultData = content;
          }
        } catch {
          // If parsing fails, use the string content directly
          resultData = content;
        }

        // AI SDK v5 expects tool messages with this exact structure
        return {
          role: "tool" as const,
          content: [
            {
              type: "tool-result" as const,
              toolCallId: toolCallId,
              toolName: toolName,
              output: {
                type: "text" as const,
                value:
                  typeof resultData === "string"
                    ? resultData
                    : JSON.stringify(resultData),
              },
            },
          ],
        };
      }

      case "assistant": {
        // For assistant messages with tool calls, we need to handle them properly
        const assistantMsg = msg as any;
        if (assistantMsg.toolCalls && Array.isArray(assistantMsg.toolCalls)) {
          // Convert tool calls to AI SDK format
          const toolCalls = assistantMsg.toolCalls.map((tc: any) => ({
            type: "tool-call" as const,
            toolCallId: tc.id || generateId(),
            toolName: tc.function?.name || tc.toolName,
            input:
              typeof tc.function?.arguments === "string"
                ? JSON.parse(tc.function.arguments)
                : tc.function?.arguments || tc.args || {},
          }));

          return {
            role: "assistant" as const,
            content: [
              ...(content ? [{ type: "text" as const, text: content }] : []),
              ...toolCalls,
            ],
          };
        }

        // Simple assistant message
        return {
          role: "assistant" as const,
          content: content || "",
        };
      }
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

export function createThinkingMessage(): ChatMessage {
  return {
    id: Math.random().toString(36).substring(2, 15),
    message: "",
    isUser: false,
    timestamp: new Date(),
    isExecuting: true,
    isPartial: true,
  };
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes("401")) {
      return "Invalid API key. Please check your LLM API settings.";
    }
    if (error.message.includes("429")) {
      return "Rate limit exceeded. Please wait a moment and try again.";
    }
    if (error.message.includes("500")) {
      return "Your LLM API is experiencing issues. Please try again later.";
    }
    return error.message;
  }
  return "An unexpected error occurred. Please try again.";
}

export function validateChatContext(context: any): boolean {
  return Boolean(
    context.connection &&
      context.llmSettings?.apiKey &&
      Array.isArray(context.tools)
  );
}

export function formatToolResultForLLM(
  toolCallId: string,
  result: any,
  toolName: string
): LLMMessage {
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
  };
}

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
