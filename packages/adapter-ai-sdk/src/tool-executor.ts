// packages/adapter-ai-sdk/src/tool-executor.ts
import { Connection, ChatMessage, ToolExecution } from "@mcpconnect/schemas";
import { ToolExecutionResult } from "./types";
import { generateId } from "./utils";
import { MCPService } from "./mcp-service";
import { SystemToolsService } from "./system-tools";

export async function executeToolWithMCP(
  connection: Connection,
  toolName: string,
  toolArgs: Record<string, any>
): Promise<ToolExecutionResult> {
  const executionId = generateId();
  const startTime = Date.now();

  try {
    // Check if it's a system tool first
    if (SystemToolsService.isSystemTool(toolName)) {
      const systemResult = await SystemToolsService.executeSystemTool(
        toolName,
        toolArgs
      );

      const chatMessage: ChatMessage = {
        id: executionId,
        isUser: false,
        executingTool: toolName,
        timestamp: new Date(),
        toolExecution: {
          toolName,
          status: systemResult.success ? "success" : "error",
          result: systemResult.result,
          error: systemResult.error,
        },
        isExecuting: false,
      };

      return {
        success: systemResult.success,
        result: systemResult.result,
        error: systemResult.error,
        toolExecution: systemResult.execution,
        chatMessage,
      };
    }

    // Otherwise, execute via MCP
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
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`[Tool Execution] Failed:`, error);

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
