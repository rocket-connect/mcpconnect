import {
  Connection,
  ChatConversation,
  Tool,
  ToolExecution,
} from "@mcpconnect/schemas";
import { nanoid } from "nanoid";

export interface MinimalShareData {
  version: string;
  timestamp: string;
  connection: {
    name: string;
    url: string;
    connectionType: string;
    // Only include essential auth if needed
    authType?: string;
    credentials?: Record<string, string>;
    headers?: Record<string, string>;
  };
  conversation: {
    title: string;
    messages: Array<{
      message?: string;
      isUser: boolean;
      timestamp: string;
      executingTool?: string;
      toolExecution?: {
        toolName: string;
        status: string;
        result?: any;
        error?: string;
      };
    }>;
  };
  tools: Array<{
    id: string;
    name: string;
    description: string;
    inputSchema?: Record<string, any>;
    parameters?: Array<{
      name: string;
      type: string;
      description?: string;
      required?: boolean;
    }>;
  }>;
  // ADD: Tool executions for request inspector
  toolExecutions: Array<{
    id: string;
    tool: string;
    status: string;
    duration?: number;
    timestamp: string;
    request: {
      tool: string;
      arguments?: Record<string, any>;
      timestamp?: string;
    };
    response?: {
      success: boolean;
      result?: any;
      timestamp?: string;
    };
    error?: string;
  }>;
  metadata: {
    shareId: string;
    toolCount: number;
    messageCount: number;
    executionCount: number;
  };
}

export class ShareService {
  private static readonly SHARE_VERSION = "2.0.0"; // New minimal version
  private static readonly MAX_SHARE_SIZE = 200000; // Much smaller limit for URL safety

  /**
   * Safely convert timestamp to ISO string
   */
  private static safeTimestampToISO(timestamp: any): string {
    if (timestamp instanceof Date) {
      return timestamp.toISOString();
    }
    if (typeof timestamp === "string") {
      // Try to parse as date, fallback to current time if invalid
      const parsed = new Date(timestamp);
      return isNaN(parsed.getTime())
        ? new Date().toISOString()
        : parsed.toISOString();
    }
    if (typeof timestamp === "number") {
      return new Date(timestamp).toISOString();
    }
    // Fallback to current time
    return new Date().toISOString();
  }

  /**
   * Create minimal shareable bundle - ONLY enabled tools and essential data
   */
  static async createMinimalShare(
    connection: Connection,
    conversation: ChatConversation,
    enabledTools: Tool[],
    toolExecutions: ToolExecution[] = []
  ): Promise<MinimalShareData> {
    // Create minimal connection data
    const minimalConnection = {
      name: connection.name,
      url: connection.url,
      connectionType: connection.connectionType,
      // Only include auth if present
      ...(connection.authType !== "none" && {
        authType: connection.authType,
        credentials: connection.credentials,
        headers: connection.headers,
      }),
    };

    // Create minimal conversation data
    const minimalConversation = {
      title: conversation.title || "Shared Chat",
      messages: conversation.messages.map(msg => ({
        message: msg.message,
        isUser: msg.isUser || false,
        timestamp: this.safeTimestampToISO(msg.timestamp),
        ...(msg.executingTool && { executingTool: msg.executingTool }),
        ...(msg.toolExecution && {
          toolExecution: {
            toolName: msg.toolExecution.toolName,
            status: msg.toolExecution.status,
            // @ts-ignore
            ...(msg.toolExecution.result && {
              result: msg.toolExecution.result,
            }),
            ...(msg.toolExecution.error && { error: msg.toolExecution.error }),
          },
        }),
      })),
    };

    // Create minimal tools data - only essential fields
    const minimalTools = enabledTools.map(tool => ({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      ...(tool.inputSchema && { inputSchema: tool.inputSchema }),
      ...(tool.parameters && {
        parameters: tool.parameters.map(param => ({
          name: param.name,
          type: param.type,
          ...(param.description && { description: param.description }),
          ...(param.required && { required: param.required }),
        })),
      }),
    }));

    // Create minimal tool executions data for request inspector
    const minimalToolExecutions = toolExecutions.map(execution => ({
      id: execution.id,
      tool: execution.tool,
      status: execution.status,
      duration: execution.duration,
      timestamp: execution.timestamp,
      request: {
        tool: execution.request.tool,
        arguments: execution.request.arguments,
        timestamp: execution.request.timestamp,
      },
      ...(execution.response && {
        response: {
          success: execution.response.success,
          result: execution.response.result,
          timestamp: execution.response.timestamp,
        },
      }),
      ...(execution.error && { error: execution.error }),
    }));

    const shareData: MinimalShareData = {
      version: this.SHARE_VERSION,
      timestamp: new Date().toISOString(),
      connection: minimalConnection,
      conversation: minimalConversation,
      tools: minimalTools,
      toolExecutions: minimalToolExecutions,
      metadata: {
        shareId: nanoid(8), // Shorter ID
        toolCount: enabledTools.length,
        messageCount: conversation.messages.length,
        executionCount: toolExecutions.length,
      },
    };

    return shareData;
  }

  /**
   * Generate ultra-compact share URL
   */
  static async generateCompactShareUrl(
    connection: Connection,
    conversation: ChatConversation,
    enabledTools: Tool[],
    toolExecutions: ToolExecution[] = [],
    selectedToolId?: string
  ): Promise<{ url: string; shareId: string }> {
    const shareData = await this.createMinimalShare(
      connection,
      conversation,
      enabledTools,
      toolExecutions
    );

    // Compress for URL
    const compressed = await this.ultraCompress(shareData);

    const baseUrl = window.location.origin;
    let shareUrl = `${baseUrl}/share/${compressed}`;

    // Add selected tool if specified
    if (selectedToolId) {
      shareUrl += `?tool=${encodeURIComponent(selectedToolId)}`;
    }

    return {
      url: shareUrl,
      shareId: shareData.metadata.shareId,
    };
  }

  /**
   * Ultra compression for minimal data
   */
  private static async ultraCompress(data: MinimalShareData): Promise<string> {
    const jsonString = JSON.stringify(data);

    console.log(`[ShareService] Original size: ${jsonString.length} bytes`);

    if (jsonString.length > this.MAX_SHARE_SIZE * 2) {
      throw new Error(
        `Share data too large (${jsonString.length} bytes). Try sharing a shorter conversation with fewer tools.`
      );
    }

    // Use base64 encoding directly for now
    const encoded = btoa(unescape(encodeURIComponent(jsonString)));

    console.log(`[ShareService] Compressed size: ${encoded.length} bytes`);

    if (encoded.length > this.MAX_SHARE_SIZE) {
      throw new Error(
        `Compressed share data still too large (${encoded.length} bytes). Try sharing fewer messages or tools.`
      );
    }

    return encoded;
  }

  /**
   * Decompress minimal share data
   */
  static async decompressMinimalShare(
    encodedData: string
  ): Promise<MinimalShareData> {
    try {
      const jsonString = decodeURIComponent(escape(atob(encodedData)));
      const data = JSON.parse(jsonString) as MinimalShareData;

      // Validate minimal data structure
      if (
        !data.version ||
        !data.connection ||
        !data.conversation ||
        !data.tools
      ) {
        throw new Error("Invalid share data format");
      }

      // Ensure toolExecutions exists (backward compatibility)
      if (!data.toolExecutions) {
        data.toolExecutions = [];
      }

      return data;
    } catch (error) {
      console.error("Failed to decompress share data:", error);
      throw new Error("Invalid or corrupted share link");
    }
  }

  /**
   * Import minimal share data
   */
  static async importMinimalShare(
    encodedData: string,
    adapter: any
  ): Promise<{ connectionId: string; chatId: string }> {
    const shareData = await this.decompressMinimalShare(encodedData);

    // Create full connection from minimal data
    const importedConnection: Connection = {
      id: nanoid(),
      name: `${shareData.connection.name} (Shared)`,
      url: shareData.connection.url,
      connectionType: shareData.connection.connectionType as any,
      isActive: false,
      isConnected: false,
      authType: (shareData.connection.authType as any) || "none",
      credentials: shareData.connection.credentials || {},
      headers: shareData.connection.headers || {},
      timeout: 30000,
      retryAttempts: 3,
    };

    // Add connection
    const existingConnections = await adapter.getConnections();
    const updatedConnections = [...existingConnections, importedConnection];
    await adapter.setConnections(updatedConnections);

    // Import tools - all tools in minimal share are enabled
    // @ts-ignore
    const fullTools: Tool[] = shareData.tools.map(tool => ({
      ...tool,
      category: undefined,
      tags: undefined,
      version: undefined,
      deprecated: false,
      parameters: tool.parameters?.map(param => ({
        ...param,
        required: param.required || false,
        default: undefined,
      })),
    }));

    await adapter.setConnectionTools(importedConnection.id, fullTools);

    // Clear any disabled tools (all shared tools are enabled)
    try {
      await adapter.delete(`disabled-tools-${importedConnection.id}`);
    } catch (error) {
      // Ignore if key doesn't exist
    }

    // Import conversation
    const importedConversation: ChatConversation = {
      id: nanoid(),
      title: `${shareData.conversation.title} (Shared)`,
      // @ts-ignore
      messages: shareData.conversation.messages.map(msg => ({
        id: nanoid(),
        message: msg.message,
        isUser: msg.isUser,
        timestamp: new Date(msg.timestamp), // Parse string back to Date
        isExecuting: false,
        ...(msg.executingTool && { executingTool: msg.executingTool }),
        ...(msg.toolExecution && { toolExecution: msg.toolExecution }),
      })),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store conversation
    const existingConversations = await adapter.get("conversations");
    const conversationsData = existingConversations?.value || {};

    if (!conversationsData[importedConnection.id]) {
      conversationsData[importedConnection.id] = [];
    }

    conversationsData[importedConnection.id].push(importedConversation);
    await adapter.set("conversations", conversationsData);

    // Import tool executions for request inspector
    if (shareData.toolExecutions && shareData.toolExecutions.length > 0) {
      const fullToolExecutions: ToolExecution[] = shareData.toolExecutions.map(
        exec => ({
          id: exec.id,
          tool: exec.tool,
          status: exec.status as "success" | "error" | "pending",
          duration: exec.duration,
          timestamp: exec.timestamp,
          request: {
            tool: exec.request.tool,
            arguments: exec.request.arguments || {},
            timestamp: exec.request.timestamp,
          },
          ...(exec.response && {
            response: {
              success: exec.response.success,
              result: exec.response.result,
              timestamp: exec.response.timestamp,
            },
          }),
          ...(exec.error && { error: exec.error }),
        })
      );

      // Store tool executions using adapter
      for (const execution of fullToolExecutions) {
        await adapter.addToolExecution(importedConnection.id, execution);
      }
    }

    return {
      connectionId: importedConnection.id,
      chatId: importedConversation.id,
    };
  }

  /**
   * Get share metadata for preview
   */
  static async getMinimalShareMetadata(encodedData: string): Promise<{
    connectionName: string;
    conversationTitle: string;
    messageCount: number;
    toolCount: number;
    executionCount: number;
    sharedBy: string;
    timestamp: string;
  }> {
    const shareData = await this.decompressMinimalShare(encodedData);

    return {
      connectionName: shareData.connection.name,
      conversationTitle: shareData.conversation.title,
      messageCount: shareData.metadata.messageCount,
      toolCount: shareData.metadata.toolCount,
      executionCount:
        shareData.metadata.executionCount ||
        shareData.toolExecutions?.length ||
        0,
      sharedBy: "MCPConnect User",
      timestamp: shareData.timestamp,
    };
  }
}
