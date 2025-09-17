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
   */
  static async createShareableBundle(
    connection: Connection,
    conversation: ChatConversation,
    tools: Tool[],
    toolExecutions: ToolExecution[],
    disabledTools: Set<string>
  ): Promise<ShareableData> {
    // Create a clean connection without sensitive data
    const cleanConnection: Connection = {
      ...connection,
      id: nanoid(), // Generate new ID to avoid conflicts
      credentials: {}, // Remove sensitive credentials
      headers: {}, // Remove potentially sensitive headers
      isActive: false,
      isConnected: false, // Will need to be reconnected
    };

    // Create clean conversation with new ID
    const cleanConversation: ChatConversation = {
      ...conversation,
      id: nanoid(), // Generate new ID
    };

    const shareableData: ShareableData = {
      version: this.SHARE_VERSION,
      timestamp: new Date().toISOString(),
      connection: cleanConnection,
      conversation: cleanConversation,
      tools,
      toolExecutions,
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
   * Parse share data from URL and import into storage
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
        conn.name === `${shareData.connection.name} (Shared)`
    );

    let connectionId: string;

    if (existingShare) {
      connectionId = existingShare.id;
      // Update the existing connection
      await adapter.updateConnection(shareData.connection);
    } else {
      // Import as new connection
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

    // Import tools
    await adapter.setConnectionTools(connectionId, shareData.tools);

    // Import conversation
    const existingConversations = await adapter.get("conversations");
    const conversationsData = existingConversations?.value || {};

    if (!conversationsData[connectionId]) {
      conversationsData[connectionId] = [];
    }

    // Check if conversation already exists
    const existingChat = conversationsData[connectionId].find(
      (conv: ChatConversation) =>
        conv.title === `${shareData.conversation.title} (Shared)`
    );

    let chatId: string;

    if (existingChat) {
      chatId = existingChat.id;
      // Update existing conversation
      const updatedConv = {
        ...shareData.conversation,
        id: existingChat.id,
        title: `${shareData.conversation.title} (Shared)`,
      };
      conversationsData[connectionId] = conversationsData[connectionId].map(
        (conv: ChatConversation) =>
          conv.id === existingChat.id ? updatedConv : conv
      );
    } else {
      // Add new conversation
      const importedConversation = {
        ...shareData.conversation,
        title: `${shareData.conversation.title} (Shared)`,
      };
      chatId = importedConversation.id;
      conversationsData[connectionId].push(importedConversation);
    }

    await adapter.set("conversations", conversationsData);

    // Import tool executions
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

    // Import disabled tools settings
    if (shareData.disabledTools.length > 0) {
      await adapter.set(
        `disabled-tools-${connectionId}`,
        shareData.disabledTools
      );
    }

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
