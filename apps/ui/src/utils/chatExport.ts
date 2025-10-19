import { ChatMessage, ChatConversation } from "@mcpconnect/schemas";

export interface ChatExportOptions {
  includeTimestamps?: boolean;
  includeToolDetails?: boolean;
  includeMetadata?: boolean;
  format?: "txt" | "json" | "markdown";
}

export class ChatExporter {
  /**
   * Export a chat conversation to various formats
   */
  static exportChat(
    conversation: ChatConversation,
    connectionName: string,
    options: ChatExportOptions = {}
  ): string {
    const {
      includeTimestamps = true,
      includeToolDetails = true,
      includeMetadata = true,
      format = "txt",
    } = options;

    switch (format) {
      case "markdown":
        return this.exportToMarkdown(conversation, connectionName, {
          includeTimestamps,
          includeToolDetails,
          includeMetadata,
        });
      case "json":
        return this.exportToJSON(conversation, connectionName, options);
      case "txt":
      default:
        return this.exportToText(conversation, connectionName, {
          includeTimestamps,
          includeToolDetails,
          includeMetadata,
        });
    }
  }

  /**
   * Export to plain text format optimized for LLM consumption
   */
  private static exportToText(
    conversation: ChatConversation,
    connectionName: string,
    options: {
      includeTimestamps: boolean;
      includeToolDetails: boolean;
      includeMetadata: boolean;
    }
  ): string {
    const { includeTimestamps, includeToolDetails, includeMetadata } = options;
    let output = "";

    // Header
    output += "=".repeat(80) + "\n";
    output += `CHAT EXPORT: ${conversation.title}\n`;
    output += `Connection: ${connectionName}\n`;
    if (includeMetadata) {
      output += `Created: ${this.formatTimestamp(conversation.createdAt)}\n`;
      output += `Updated: ${this.formatTimestamp(conversation.updatedAt)}\n`;
      output += `Messages: ${conversation.messages.length}\n`;
    }
    output += "=".repeat(80) + "\n\n";

    // Process messages
    const processedMessages = this.processMessages(conversation.messages);

    processedMessages.forEach((msg, index) => {
      // Message separator
      if (index > 0) {
        output += "\n" + "-".repeat(60) + "\n\n";
      }

      // Message header
      const role = msg.isUser ? "USER" : "ASSISTANT";
      output += `[${role}]`;

      if (includeTimestamps && msg.timestamp) {
        output += ` (${this.formatTimestamp(msg.timestamp)})`;
      }
      output += "\n\n";

      // Tool execution info
      if (msg.isExecuting && msg.executingTool) {
        output += `🔧 EXECUTING TOOL: ${msg.executingTool}\n\n`;
      } else if (msg.toolExecution) {
        const { toolName, status, result, error } = msg.toolExecution;

        output += `🛠️ TOOL EXECUTION: ${toolName}\n`;
        output += `Status: ${status.toUpperCase()}\n`;

        if (includeToolDetails) {
          if (result !== undefined) {
            output += "\n--- Tool Result ---\n";
            output += this.formatToolResult(result);
            output += "\n--- End Tool Result ---\n";
          }

          if (error) {
            output += `\nError: ${error}\n`;
          }
        }
        output += "\n";
      }

      // Message content
      if (msg.message && msg.message.trim()) {
        output += msg.message.trim() + "\n";
      }
    });

    // Footer
    output += "\n" + "=".repeat(80) + "\n";
    output += `End of chat export - ${processedMessages.length} messages total\n`;
    output += `Exported on: ${new Date().toISOString()}\n`;
    output += "=".repeat(80);

    return output;
  }

  /**
   * Export to Markdown format
   */
  private static exportToMarkdown(
    conversation: ChatConversation,
    connectionName: string,
    options: {
      includeTimestamps: boolean;
      includeToolDetails: boolean;
      includeMetadata: boolean;
    }
  ): string {
    const { includeTimestamps, includeToolDetails, includeMetadata } = options;
    let output = "";

    // Header
    output += `# Chat Export: ${conversation.title}\n\n`;

    if (includeMetadata) {
      output += `**Connection:** ${connectionName}  \n`;
      output += `**Created:** ${this.formatTimestamp(conversation.createdAt)}  \n`;
      output += `**Updated:** ${this.formatTimestamp(conversation.updatedAt)}  \n`;
      output += `**Messages:** ${conversation.messages.length}  \n\n`;
    }

    output += "---\n\n";

    // Process messages
    const processedMessages = this.processMessages(conversation.messages);

    processedMessages.forEach(msg => {
      // Message header
      const role = msg.isUser ? "User" : "Assistant";
      const roleEmoji = msg.isUser ? "👤" : "🤖";

      output += `## ${roleEmoji} ${role}`;

      if (includeTimestamps && msg.timestamp) {
        output += ` *(${this.formatTimestamp(msg.timestamp)})*`;
      }
      output += "\n\n";

      // Tool execution info
      if (msg.isExecuting && msg.executingTool) {
        output += `> 🔧 **Executing tool:** \`${msg.executingTool}\`\n\n`;
      } else if (msg.toolExecution) {
        const { toolName, status, result, error } = msg.toolExecution;

        output += `> 🛠️ **Tool Execution:** \`${toolName}\`  \n`;
        output += `> **Status:** ${status.toUpperCase()}  \n\n`;

        if (includeToolDetails) {
          if (result !== undefined) {
            output += "**Tool Result:**\n\n```json\n";
            output += this.formatToolResult(result);
            output += "\n```\n\n";
          }

          if (error) {
            output += `**Error:** \`${error}\`\n\n`;
          }
        }
      }

      // Message content
      if (msg.message && msg.message.trim()) {
        output += msg.message.trim() + "\n\n";
      }

      output += "---\n\n";
    });

    // Footer
    output += `*Exported on ${new Date().toISOString()}*\n`;

    return output;
  }

  /**
   * Export to JSON format
   */
  private static exportToJSON(
    conversation: ChatConversation,
    connectionName: string,
    options: ChatExportOptions
  ): string {
    const exportData = {
      metadata: {
        title: conversation.title,
        connectionName,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        messageCount: conversation.messages.length,
        exportedAt: new Date().toISOString(),
        exportOptions: options,
      },
      conversation: {
        id: conversation.id,
        title: conversation.title,
        messages: this.processMessages(conversation.messages).map(msg => ({
          id: msg.id,
          message: msg.message,
          isUser: msg.isUser,
          timestamp: msg.timestamp,
          isExecuting: msg.isExecuting,
          executingTool: msg.executingTool,
          toolExecution: msg.toolExecution
            ? {
                toolName: msg.toolExecution.toolName,
                status: msg.toolExecution.status,
                result: msg.toolExecution.result,
                error: msg.toolExecution.error,
              }
            : undefined,
        })),
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Process and filter messages for export
   */
  private static processMessages(messages: ChatMessage[]): ChatMessage[] {
    return messages.filter(msg => {
      // Filter out empty execution messages without content
      if (
        msg.isExecuting &&
        !msg.message &&
        !msg.executingTool &&
        !msg.toolExecution
      ) {
        return false;
      }
      return true;
    });
  }

  /**
   * Format tool result for display
   */
  private static formatToolResult(result: any): string {
    if (result === null || result === undefined) {
      return "null";
    }

    if (typeof result === "string") {
      return result;
    }

    try {
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return String(result);
    }
  }

  /**
   * Format timestamp for display
   */
  private static formatTimestamp(timestamp: Date | string): string {
    const date =
      typeof timestamp === "string" ? new Date(timestamp) : timestamp;

    if (isNaN(date.getTime())) {
      return "Invalid Date";
    }

    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  }

  /**
   * Download the exported chat as a file
   */
  static downloadChatExport(
    conversation: ChatConversation,
    connectionName: string,
    options: ChatExportOptions = {}
  ): void {
    const { format = "txt" } = options;
    const content = this.exportChat(conversation, connectionName, options);

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const sanitizedTitle = conversation?.title
      ?.replace(/[^a-zA-Z0-9\s-]/g, "")
      .trim();
    const filename = `${sanitizedTitle}_${timestamp}.${format}`;

    this.downloadFile(content, filename, this.getMimeType(format));
  }

  /**
   * Copy chat export to clipboard
   */
  static async copyChatToClipboard(
    conversation: ChatConversation,
    connectionName: string,
    options: ChatExportOptions = {}
  ): Promise<void> {
    const content = this.exportChat(conversation, connectionName, options);

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(content);
      } else {
        // Fallback for non-secure contexts
        const textArea = document.createElement("textarea");
        textArea.value = content;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      throw new Error("Failed to copy chat to clipboard");
    }
  }

  /**
   * Helper to download a file
   */
  private static downloadFile(
    content: string,
    filename: string,
    mimeType: string
  ): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the URL object
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  /**
   * Get MIME type for format
   */
  private static getMimeType(format: string): string {
    switch (format) {
      case "json":
        return "application/json";
      case "markdown":
        return "text/markdown";
      case "txt":
      default:
        return "text/plain";
    }
  }
}
