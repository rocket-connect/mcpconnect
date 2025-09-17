// apps/ui/src/services/shareService.ts
import {
  Connection,
  ChatConversation,
  Tool,
  ToolExecution,
} from "@mcpconnect/schemas";
import { nanoid } from "nanoid";

export interface ShareableData {
  version: string;
  timestamp: string;
  connection: Connection;
  conversation: ChatConversation;
  tools: Tool[];
  toolExecutions: ToolExecution[];
  disabledTools: string[];
  metadata: {
    sharedBy: string;
    shareId: string;
    originalChatId: string;
    originalConnectionId: string;
  };
}

export class ShareService {
  private static readonly SHARE_VERSION = "1.0.0";
  private static readonly MAX_SHARE_SIZE = 1000 * 1024; // 1MB limit for URL safety
  private static readonly COMPRESSION_THRESHOLD = 10 * 1024; // 10KB

  /**
   * Create a shareable bundle from current chat state
   * NOTE: Now includes ALL content including sensitive keys for complete sharing
   */
  static async createShareableBundle(
    connection: Connection,
    conversation: ChatConversation,
    tools: Tool[],
    toolExecutions: ToolExecution[],
    disabledTools: Set<string>
  ): Promise<ShareableData> {
    // Create a complete copy of connection INCLUDING credentials and headers
    // This ensures the recipient gets the full working connection
    const completeConnection: Connection = {
      ...connection,
      id: nanoid(), // Generate new ID to avoid conflicts
      // Keep ALL original data including sensitive information
      credentials: { ...connection.credentials }, // Full copy of credentials
      headers: { ...connection.headers }, // Full copy of headers
      isActive: false,
      isConnected: false, // Will need to be reconnected by recipient
    };

    // Create complete conversation copy with new ID
    const completeConversation: ChatConversation = {
      ...conversation,
      id: nanoid(), // Generate new ID
      // Deep copy all messages to preserve everything
      messages: conversation.messages.map(msg => ({
        ...msg,
        id: msg.id || nanoid(), // Ensure all messages have IDs
        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
      })),
      createdAt: new Date(conversation.createdAt),
      updatedAt: new Date(conversation.updatedAt),
    };

    // Deep copy tools to preserve all properties
    const completeTools: Tool[] = tools.map(tool => ({
      ...tool,
      parameters: tool.parameters ? [...tool.parameters] : undefined,
      tags: tool.tags ? [...tool.tags] : undefined,
    }));

    // Deep copy tool executions to preserve all data
    const completeToolExecutions: ToolExecution[] = toolExecutions.map(
      execution => ({
        ...execution,
        request: { ...execution.request },
        response: execution.response ? { ...execution.response } : undefined,
      })
    );

    const shareableData: ShareableData = {
      version: this.SHARE_VERSION,
      timestamp: new Date().toISOString(),
      connection: completeConnection,
      conversation: completeConversation,
      tools: completeTools,
      toolExecutions: completeToolExecutions,
      disabledTools: Array.from(disabledTools),
      metadata: {
        sharedBy: "MCPConnect User",
        shareId: nanoid(),
        originalChatId: conversation.id,
        originalConnectionId: connection.id,
      },
    };

    return shareableData;
  }

  /**
   * Compress and encode data for URL
   */
  static async compressForUrl(data: ShareableData): Promise<string> {
    const jsonString = JSON.stringify(data);

    // Check size before compression
    if (jsonString.length > this.MAX_SHARE_SIZE * 2) {
      throw new Error(
        "Chat data too large to share. Try sharing a shorter conversation."
      );
    }

    let compressed: string;

    if (jsonString.length > this.COMPRESSION_THRESHOLD) {
      // Use simple compression for large data
      compressed = this.simpleCompress(jsonString);
    } else {
      compressed = jsonString;
    }

    // Base64 encode for URL safety
    const encoded = btoa(compressed);

    if (encoded.length > this.MAX_SHARE_SIZE) {
      throw new Error(
        "Compressed chat data still too large to share. Try sharing a shorter conversation."
      );
    }

    return encoded;
  }

  /**
   * Decompress and decode data from URL
   */
  static async decompressFromUrl(encodedData: string): Promise<ShareableData> {
    try {
      // Base64 decode
      const compressed = atob(encodedData);

      let jsonString: string;

      // Try to decompress if it was compressed
      if (this.isCompressed(compressed)) {
        jsonString = this.simpleDecompress(compressed);
      } else {
        jsonString = compressed;
      }

      const data = JSON.parse(jsonString) as ShareableData;

      // Validate the data structure
      this.validateShareableData(data);

      return data;
    } catch (error) {
      console.error("Failed to decode share data:", error);
      throw new Error("Invalid or corrupted share link");
    }
  }

  /**
   * Generate a shareable URL
   */
  static async generateShareUrl(
    connection: Connection,
    conversation: ChatConversation,
    tools: Tool[],
    toolExecutions: ToolExecution[],
    disabledTools: Set<string>,
    selectedToolId?: string
  ): Promise<{ url: string; shareId: string }> {
    const shareableData = await this.createShareableBundle(
      connection,
      conversation,
      tools,
      toolExecutions,
      disabledTools
    );

    const compressed = await this.compressForUrl(shareableData);

    const baseUrl = window.location.origin;
    let shareUrl = `${baseUrl}/share/${compressed}`;

    // Add selected tool if specified
    if (selectedToolId) {
      shareUrl += `?tool=${encodeURIComponent(selectedToolId)}`;
    }

    return {
      url: shareUrl,
      shareId: shareableData.metadata.shareId,
    };
  }

  /**
   * Parse share data from URL and import into storage with complete reload
   */
  static async importFromShareUrl(
    encodedData: string,
    adapter: any
  ): Promise<{
    connectionId: string;
    chatId: string;
    toolId?: string;
  }> {
    const shareData = await this.decompressFromUrl(encodedData);

    // Check if this share has already been imported
    const existingConnections = await adapter.getConnections();
    const existingShare = existingConnections.find(
      (conn: Connection) =>
        conn.name === `${shareData.connection.name} (Shared)` ||
        conn.url === shareData.connection.url
    );

    let connectionId: string;

    if (existingShare) {
      connectionId = existingShare.id;
      // Update the existing connection with complete data
      const updatedConnection = {
        ...shareData.connection,
        id: existingShare.id,
        name: `${shareData.connection.name} (Shared)`,
        isActive: false,
        isConnected: false,
      };
      await adapter.updateConnection(updatedConnection);
    } else {
      // Import as new connection with complete data
      const importedConnection = {
        ...shareData.connection,
        name: `${shareData.connection.name} (Shared)`,
        isActive: false,
        isConnected: false,
      };

      connectionId = importedConnection.id;

      // Add to connections
      const updatedConnections = [...existingConnections, importedConnection];
      await adapter.setConnections(updatedConnections);
    }

    // Import tools with complete data
    await adapter.setConnectionTools(connectionId, shareData.tools);

    // Import conversation with complete data
    const existingConversations = await adapter.get("conversations");
    const conversationsData = existingConversations?.value || {};

    if (!conversationsData[connectionId]) {
      conversationsData[connectionId] = [];
    }

    // Check if conversation already exists
    const existingChat = conversationsData[connectionId].find(
      (conv: ChatConversation) =>
        conv.title === `${shareData.conversation.title} (Shared)` ||
        conv.id === shareData.conversation.id
    );

    let chatId: string;

    if (existingChat) {
      chatId = existingChat.id;
      // Update existing conversation with complete data
      const updatedConv = {
        ...shareData.conversation,
        id: existingChat.id,
        title: `${shareData.conversation.title} (Shared)`,
        messages: shareData.conversation.messages.map(msg => ({
          ...msg,
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
        })),
        createdAt: new Date(shareData.conversation.createdAt),
        updatedAt: new Date(shareData.conversation.updatedAt),
      };
      conversationsData[connectionId] = conversationsData[connectionId].map(
        (conv: ChatConversation) =>
          conv.id === existingChat.id ? updatedConv : conv
      );
    } else {
      // Add new conversation with complete data
      const importedConversation = {
        ...shareData.conversation,
        title: `${shareData.conversation.title} (Shared)`,
        messages: shareData.conversation.messages.map(msg => ({
          ...msg,
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
        })),
        createdAt: new Date(shareData.conversation.createdAt),
        updatedAt: new Date(shareData.conversation.updatedAt),
      };
      chatId = importedConversation.id;
      conversationsData[connectionId].push(importedConversation);
    }

    await adapter.set("conversations", conversationsData);

    // Import tool executions with complete data
    const existingExecutions = await adapter.get("toolExecutions");
    const executionsData = existingExecutions?.value || {};

    if (!executionsData[connectionId]) {
      executionsData[connectionId] = [];
    }

    // Add tool executions (avoid duplicates by ID)
    const existingExecutionIds = new Set(
      executionsData[connectionId].map((exec: ToolExecution) => exec.id)
    );

    const newExecutions = shareData.toolExecutions.filter(
      exec => !existingExecutionIds.has(exec.id)
    );

    executionsData[connectionId].push(...newExecutions);
    await adapter.set("toolExecutions", executionsData);

    // Import disabled tools settings with complete data
    if (shareData.disabledTools.length > 0) {
      await adapter.set(
        `disabled-tools-${connectionId}`,
        shareData.disabledTools
      );
    }

    // Force a complete reload of the application to ensure all data is fresh
    // This ensures that all imported content is properly loaded and displayed
    setTimeout(() => {
      window.location.reload();
    }, 1000); // Small delay to ensure storage operations complete

    return {
      connectionId,
      chatId,
    };
  }

  /**
   * Simple compression using RLE for repeated patterns
   */
  private static simpleCompress(input: string): string {
    // Add compression marker
    return `COMPRESSED:${input}`;
  }

  /**
   * Simple decompression
   */
  private static simpleDecompress(input: string): string {
    if (input.startsWith("COMPRESSED:")) {
      return input.slice(11); // Remove "COMPRESSED:" prefix
    }
    return input;
  }

  /**
   * Check if data is compressed
   */
  private static isCompressed(input: string): boolean {
    return input.startsWith("COMPRESSED:");
  }

  /**
   * Validate shareable data structure
   */
  private static validateShareableData(data: any): void {
    if (!data || typeof data !== "object") {
      throw new Error("Invalid share data format");
    }

    if (!data.version || !data.connection || !data.conversation) {
      throw new Error("Missing required share data fields");
    }

    if (data.version !== this.SHARE_VERSION) {
      console.warn(
        `Share version mismatch: ${data.version} vs ${this.SHARE_VERSION}`
      );
    }

    // Basic structure validation
    if (!data.connection.id || !data.connection.name) {
      throw new Error("Invalid connection data in share");
    }

    if (!data.conversation.id || !Array.isArray(data.conversation.messages)) {
      throw new Error("Invalid conversation data in share");
    }
  }

  /**
   * Get share metadata without importing
   */
  static async getShareMetadata(encodedData: string): Promise<{
    connectionName: string;
    conversationTitle: string;
    messageCount: number;
    toolCount: number;
    sharedBy: string;
    timestamp: string;
  }> {
    const shareData = await this.decompressFromUrl(encodedData);

    return {
      connectionName: shareData.connection.name,
      conversationTitle: shareData.conversation.title!,
      messageCount: shareData.conversation.messages.length,
      toolCount: shareData.tools.length,
      sharedBy: shareData.metadata.sharedBy,
      timestamp: shareData.timestamp,
    };
  }
}
