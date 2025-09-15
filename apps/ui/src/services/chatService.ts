// apps/ui/src/services/chatService.ts
import {
  Connection,
  Tool,
  ChatMessage,
  ToolExecution,
} from "@mcpconnect/schemas";
import { MCPService } from "./mcpService";
import { LLMSettings } from "./modelService";
import { nanoid } from "nanoid";

export interface ChatContext {
  connection: Connection;
  tools: Tool[];
  llmSettings: LLMSettings;
}

export interface ChatResponse {
  assistantMessage: ChatMessage;
  toolExecutionMessages: ChatMessage[];
}

export interface ToolExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  toolExecution: ToolExecution;
  chatMessage: ChatMessage;
}

/**
 * Centralized service for chat functionality and LLM communication
 */
export class ChatService {
  /**
   * Send a message to Claude with tool support
   */
  static async sendMessage(
    userMessage: string,
    context: ChatContext,
    conversationHistory: ChatMessage[] = []
  ): Promise<ChatResponse> {
    const { tools, llmSettings } = context;

    if (!llmSettings.apiKey) {
      throw new Error("No Claude API key configured");
    }

    console.log(
      `[ChatService] Sending message with ${tools.length} available tools`
    );

    // Convert conversation history to Claude format (filter out tool execution messages)
    const claudeMessages = conversationHistory
      .filter(
        msg =>
          msg.message &&
          msg.message.trim() &&
          !msg.executingTool &&
          !msg.toolExecution
      )
      .map(msg => ({
        role: msg.isUser ? ("user" as const) : ("assistant" as const),
        content: msg.message || "",
      }));

    // Add the new user message
    claudeMessages.push({
      role: "user",
      content: userMessage,
    });

    // Convert available tools to Claude format
    const claudeTools = tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema || {
        type: "object",
        properties: {},
        required: [],
      },
    }));

    const requestBody = {
      model: llmSettings.model,
      max_tokens: llmSettings.maxTokens,
      temperature: llmSettings.temperature,
      messages: claudeMessages,
      ...(claudeTools.length > 0 && { tools: claudeTools }),
    };

    console.log(
      `[ChatService] Calling Claude API with ${claudeMessages.length} messages and ${claudeTools.length} tools`
    );

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
        "x-api-key": llmSettings.apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Claude API request failed: ${response.status} ${response.statusText}: ${errorText}`
      );
    }

    const data = await response.json();
    console.log(`[ChatService] Received Claude response:`, data);

    // Process the response and handle tool calls
    return await this.processClaudeResponse(data, context, claudeMessages);
  }

  /**
   * Process Claude's response and handle any tool calls
   */
  private static async processClaudeResponse(
    claudeResponse: any,
    context: ChatContext,
    conversationMessages: any[]
  ): Promise<ChatResponse> {
    const { connection, tools, llmSettings } = context;
    const toolExecutionMessages: ChatMessage[] = [];

    if (!claudeResponse.content) {
      throw new Error("No content in Claude response");
    }

    let responseText = "";
    const toolResults: any[] = [];

    // Process each content block
    for (const content of claudeResponse.content) {
      if (content.type === "text") {
        responseText += content.text;
      } else if (content.type === "tool_use") {
        // Execute the tool
        const toolName = content.name;
        const toolArgs = content.input;
        const toolCallId = content.id;

        console.log(
          `[ChatService] Claude wants to use tool: ${toolName}`,
          toolArgs
        );

        // Execute the tool and get the result
        const toolResult = await this.executeToolWithTracking(
          connection,
          toolName,
          toolArgs
        );

        // Add the tool execution message to our list
        toolExecutionMessages.push(toolResult.chatMessage);

        // Add tool result for Claude's follow-up
        const resultText = this.formatToolResultForClaude(toolResult.result);
        toolResults.push({
          tool_use_id: toolCallId,
          type: "tool_result",
          content: resultText,
        });
      }
    }

    // If tools were used, send results back to Claude for final response
    if (toolResults.length > 0) {
      console.log(
        `[ChatService] Sending ${toolResults.length} tool results back to Claude`
      );

      const followUpMessages = [
        ...conversationMessages,
        {
          role: "assistant" as const,
          content: claudeResponse.content,
        },
        {
          role: "user" as const,
          content: toolResults,
        },
      ];

      try {
        const followUpResponse = await fetch(
          "https://api.anthropic.com/v1/messages",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "anthropic-version": "2023-06-01",
              "anthropic-dangerous-direct-browser-access": "true",
              "x-api-key": llmSettings.apiKey,
            },
            body: JSON.stringify({
              model: llmSettings.model,
              max_tokens: llmSettings.maxTokens,
              temperature: llmSettings.temperature,
              messages: followUpMessages,
              tools: tools.map(tool => ({
                name: tool.name,
                description: tool.description,
                input_schema: tool.inputSchema || {
                  type: "object",
                  properties: {},
                  required: [],
                },
              })),
            }),
          }
        );

        if (followUpResponse.ok) {
          const followUpData = await followUpResponse.json();
          responseText =
            followUpData.content?.[0]?.text ||
            responseText ||
            "Tool executed successfully.";
        } else {
          console.error(
            "Follow-up request failed:",
            await followUpResponse.text()
          );
          responseText =
            responseText ||
            "Tool executed, but failed to get follow-up response.";
        }
      } catch (followUpError) {
        console.error("Follow-up request error:", followUpError);
        responseText = responseText || "Tool executed successfully.";
      }
    }

    // Create the final assistant message
    const assistantMessage: ChatMessage = {
      id: nanoid(),
      message: responseText || "I executed the requested tools.",
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
   * Execute a tool via MCPService and track the execution
   */
  private static async executeToolWithTracking(
    connection: Connection,
    toolName: string,
    toolArgs: Record<string, any>
  ): Promise<ToolExecutionResult> {
    const executionId = nanoid();

    try {
      console.log(`[ChatService] Executing tool: ${toolName}`, toolArgs);

      // Execute via MCPService
      const mcpResult = await MCPService.executeTool(
        connection,
        toolName,
        toolArgs
      );

      // Create success chat message
      const chatMessage: ChatMessage = {
        id: executionId,
        isUser: false,
        executingTool: toolName,
        timestamp: new Date(),
        toolExecution: {
          toolName,
          status: "success",
          result: mcpResult.result,
        },
        isExecuting: false,
      };

      return {
        success: true,
        result: mcpResult.result,
        toolExecution: mcpResult.execution,
        chatMessage,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[ChatService] Tool execution failed:`, error);

      // Create error chat message
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

      // Create error execution object
      const errorExecution: ToolExecution = {
        id: executionId,
        tool: toolName,
        status: "error",
        duration: 0,
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
   * Format tool result for Claude API
   */
  private static formatToolResultForClaude(result: any): string {
    if (typeof result === "string") {
      return result;
    }

    // Handle MCP response format
    if (result?.content?.[0]?.text) {
      try {
        const parsedResult = JSON.parse(result.content[0].text);
        return JSON.stringify(parsedResult, null, 2);
      } catch {
        return result.content[0].text;
      }
    }

    return JSON.stringify(result, null, 2);
  }

  /**
   * Store tool execution in localStorage for tracking
   */
  static async storeToolExecution(
    connectionId: string,
    execution: ToolExecution
  ): Promise<void> {
    try {
      // Get current executions
      const toolExecutionsItem = localStorage.getItem(
        "mcpconnect:toolExecutions"
      );
      let toolExecutionsData = toolExecutionsItem
        ? JSON.parse(toolExecutionsItem)
        : { value: {} };

      // Initialize connection executions if needed
      if (!toolExecutionsData.value[connectionId]) {
        toolExecutionsData.value[connectionId] = [];
      }

      const currentExecutions = toolExecutionsData.value[connectionId];

      // Update or add the execution
      const existingIndex = currentExecutions.findIndex(
        (exec: ToolExecution) => exec.id === execution.id
      );

      if (existingIndex !== -1) {
        // Update existing execution
        currentExecutions[existingIndex] = {
          ...currentExecutions[existingIndex],
          ...execution,
        };
      } else {
        // Add new execution
        currentExecutions.push(execution);
      }

      // Update metadata
      toolExecutionsData.metadata = {
        ...toolExecutionsData.metadata,
        updatedAt: new Date(),
        size: JSON.stringify(toolExecutionsData.value).length,
        type: "object",
      };

      // Store back to localStorage
      localStorage.setItem(
        "mcpconnect:toolExecutions",
        JSON.stringify(toolExecutionsData)
      );

      console.log(
        `[ChatService] Stored tool execution for ${connectionId}:`,
        execution.id
      );
    } catch (error) {
      console.error("Failed to store tool execution:", error);
    }
  }

  /**
   * Create a pending tool execution message
   */
  static createPendingToolMessage(toolName: string): ChatMessage {
    return {
      id: nanoid(),
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

  /**
   * Create a thinking message for Claude
   */
  static createThinkingMessage(): ChatMessage {
    return {
      id: nanoid(),
      message: "",
      isUser: false,
      timestamp: new Date(),
      isExecuting: true,
    };
  }

  /**
   * Validate chat context
   */
  static validateChatContext(context: ChatContext): boolean {
    return Boolean(
      context.connection &&
        context.llmSettings?.apiKey &&
        Array.isArray(context.tools)
    );
  }

  /**
   * Get error message for chat failures
   */
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
}
