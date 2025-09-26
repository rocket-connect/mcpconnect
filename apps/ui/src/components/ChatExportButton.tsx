import React, { useState } from "react";
import {
  Download,
  Copy,
  FileText,
  FileCode,
  Hash,
  ChevronDown,
  Check,
  AlertCircle,
} from "lucide-react";
import { ChatConversation } from "@mcpconnect/schemas";
import { ChatExporter, ChatExportOptions } from "../utils/chatExport";

export interface ChatExportButtonProps {
  conversation: ChatConversation;
  connectionName: string;
  className?: string;
  disabled?: boolean;
}

export const ChatExportButton: React.FC<ChatExportButtonProps> = ({
  conversation,
  connectionName,
  className = "",
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Reset status after 3 seconds
  React.useEffect(() => {
    if (exportSuccess || exportError) {
      const timer = setTimeout(() => {
        setExportSuccess(null);
        setExportError(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [exportSuccess, exportError]);

  const handleExport = async (
    format: "txt" | "json" | "markdown",
    action: "download" | "copy"
  ) => {
    if (!conversation || disabled) return;

    setIsExporting(true);
    setExportError(null);
    setExportSuccess(null);
    setIsOpen(false);

    try {
      const options: ChatExportOptions = {
        format,
        includeTimestamps: true,
        includeToolDetails: true,
        includeMetadata: true,
      };

      if (action === "download") {
        ChatExporter.downloadChatExport(conversation, connectionName, options);
        setExportSuccess(`Chat exported as ${format.toUpperCase()} file`);
      } else {
        await ChatExporter.copyChatToClipboard(
          conversation,
          connectionName,
          options
        );
        setExportSuccess(`Chat copied to clipboard as ${format.toUpperCase()}`);
      }
    } catch (error) {
      console.error("Export failed:", error);
      setExportError(error instanceof Error ? error.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const getMessageCount = () => {
    if (!conversation?.messages) return 0;
    return conversation.messages.filter(
      msg =>
        msg.message ||
        msg.toolExecution ||
        (msg.isExecuting && msg.executingTool)
    ).length;
  };

  const messageCount = getMessageCount();

  // Don't render if no messages to export
  if (messageCount === 0) {
    return null;
  }

  return (
    <div className={`relative ${className}`}>
      {/* Main Export Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || isExporting}
        className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border transition-all duration-200 ${
          disabled || isExporting
            ? "opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400"
            : exportSuccess
              ? "bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300"
              : exportError
                ? "bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300"
                : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
        }`}
        title={`Export chat (${messageCount} messages)`}
      >
        {isExporting ? (
          <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
        ) : exportSuccess ? (
          <Check className="w-3 h-3" />
        ) : exportError ? (
          <AlertCircle className="w-3 h-3" />
        ) : (
          <Download className="w-3 h-3" />
        )}

        <span className="hidden sm:inline">
          {isExporting
            ? "Exporting..."
            : exportSuccess
              ? "Exported!"
              : exportError
                ? "Failed"
                : "Export"}
        </span>

        {!isExporting && !exportSuccess && !exportError && (
          <ChevronDown
            className={`w-3 h-3 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {/* Status Message */}
      {(exportSuccess || exportError) && (
        <div className="absolute top-full left-0 mt-1 z-50">
          <div
            className={`px-3 py-2 rounded-md shadow-sm text-xs font-medium whitespace-nowrap ${
              exportSuccess
                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700"
                : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700"
            }`}
          >
            {exportSuccess || exportError}
          </div>
        </div>
      )}

      {/* Dropdown Menu */}
      {isOpen && !exportSuccess && !exportError && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute top-full right-0 mt-1 z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg min-w-48">
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700 mb-2">
                Export {messageCount} messages
              </div>

              {/* Text Format */}
              <div className="space-y-1">
                <div className="px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                  Plain Text (LLM Ready)
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={() => handleExport("txt", "download")}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                  >
                    <FileText className="w-3 h-3" />
                    Download
                  </button>
                  <button
                    onClick={() => handleExport("txt", "copy")}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    Copy
                  </button>
                </div>
              </div>

              <div className="border-t border-gray-100 dark:border-gray-700 mt-2 pt-2">
                {/* Markdown Format */}
                <div className="space-y-1">
                  <div className="px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                    Markdown
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      onClick={() => handleExport("markdown", "download")}
                      className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                    >
                      <Hash className="w-3 h-3" />
                      Download
                    </button>
                    <button
                      onClick={() => handleExport("markdown", "copy")}
                      className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                      Copy
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 dark:border-gray-700 mt-2 pt-2">
                {/* JSON Format */}
                <div className="space-y-1">
                  <div className="px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                    JSON (Structured)
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      onClick={() => handleExport("json", "download")}
                      className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                    >
                      <FileCode className="w-3 h-3" />
                      Download
                    </button>
                    <button
                      onClick={() => handleExport("json", "copy")}
                      className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                      Copy
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 dark:border-gray-700 mt-2 pt-2">
                <div className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400">
                  Includes tool executions, responses, and timestamps
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
