// apps/ui/src/components/ShareModal.tsx
import React, { useState } from "react";
import {
  X,
  Share2,
  Copy,
  CheckCircle,
  AlertCircle,
  Loader,
  ExternalLink,
  Users,
  MessageSquare,
  Settings,
} from "lucide-react";
import {
  Connection,
  ChatConversation,
  Tool,
  ToolExecution,
} from "@mcpconnect/schemas";
import { ShareService } from "../services/shareService";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  connection: Connection;
  conversation: ChatConversation;
  tools: Tool[];
  toolExecutions: ToolExecution[];
  disabledTools: Set<string>;
  selectedToolId?: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  connection,
  conversation,
  tools,
  toolExecutions,
  disabledTools,
  selectedToolId,
}) => {
  const [shareUrl, setShareUrl] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareId, setShareId] = useState<string>("");

  const handleGenerateShare = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const { url, shareId: id } = await ShareService.generateShareUrl(
        connection,
        conversation,
        tools,
        toolExecutions,
        disabledTools,
        selectedToolId
      );

      setShareUrl(url);
      setShareId(id);
    } catch (err) {
      console.error("Failed to generate share URL:", err);
      setError(
        err instanceof Error ? err.message : "Failed to generate share link"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy URL:", err);
      setError("Failed to copy URL to clipboard");
    }
  };

  const handleOpenInNewTab = () => {
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  };

  // Calculate stats
  const enabledToolsCount = tools.length - disabledTools.size;
  const messageCount = conversation.messages.length;
  const toolExecutionCount = toolExecutions.length;

  // Reset state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setShareUrl("");
      setError(null);
      setIsCopied(false);
      setShareId("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Share Chat Session
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Chat Preview */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Share Preview
            </h3>

            <div className="space-y-4">
              {/* Connection Info */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <ExternalLink className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {connection.name}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                    {connection.url}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Settings className="w-3 h-3" />
                      {enabledToolsCount} tools enabled
                      {disabledTools.size > 0 &&
                        ` (${disabledTools.size} disabled)`}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {messageCount} messages
                    </span>
                    {toolExecutionCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Share2 className="w-3 h-3" />
                        {toolExecutionCount} tool executions
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Conversation Info */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {conversation.title}
                  </h4>
                  {conversation?.createdAt?.toLocaleDateString && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Created {conversation.createdAt.toLocaleDateString()} at{" "}
                      {conversation.createdAt.toLocaleTimeString()}
                    </p>
                  )}
                  {selectedToolId && (
                    <div className="mt-2 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded text-xs">
                      Tool selected: {selectedToolId}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Share Information */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
              <Users className="w-4 h-4" />
              What gets shared:
            </h3>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>• Complete conversation history ({messageCount} messages)</li>
              <li>• Connection details (without sensitive credentials)</li>
              <li>• Available tools ({tools.length} tools)</li>
              <li>
                • Tool execution history ({toolExecutionCount} executions)
              </li>
              <li>• Tool enablement settings</li>
              {selectedToolId && <li>• Selected tool for direct inspection</li>}
            </ul>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-3">
              <strong>Note:</strong> Sensitive data like API keys and
              authentication tokens are automatically removed for security.
            </p>
          </div>

          {/* Generate Share URL */}
          {!shareUrl && (
            <div className="text-center">
              <button
                onClick={handleGenerateShare}
                disabled={isGenerating}
                className="flex items-center gap-2 mx-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isGenerating ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Generating Share Link...
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    Generate Share Link
                  </>
                )}
              </button>
            </div>
          )}

          {/* Share URL Display */}
          {shareUrl && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Share URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
                  />
                  <button
                    onClick={handleCopyUrl}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    {isCopied ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleOpenInNewTab}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open
                  </button>
                </div>
              </div>

              {/* Share Stats */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-3 gap-4 text-center text-sm">
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {shareUrl.length.toLocaleString()}
                    </div>
                    <div className="text-gray-600 dark:text-gray-400">
                      URL Length
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {shareId.slice(0, 8)}...
                    </div>
                    <div className="text-gray-600 dark:text-gray-400">
                      Share ID
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {new Date().toLocaleDateString()}
                    </div>
                    <div className="text-gray-600 dark:text-gray-400">
                      Generated
                    </div>
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                <h4 className="text-sm font-medium text-green-900 dark:text-green-100 mb-2">
                  Ready to Share!
                </h4>
                <p className="text-sm text-green-800 dark:text-green-200">
                  Share this complete URL with your friend. When they visit the
                  link, it will:
                </p>
                <ul className="text-sm text-green-800 dark:text-green-200 mt-2 space-y-1">
                  <li>
                    • Import the connection and conversation into their
                    MCPConnect
                  </li>
                  <li>• Restore all tool settings and execution history</li>
                  <li>• Navigate directly to the shared chat</li>
                  {selectedToolId && (
                    <li>• Open the selected tool in the inspector</li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                <AlertCircle className="w-4 h-4" />
                <span className="font-medium">Error</span>
              </div>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                {error}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          {shareUrl && (
            <button
              onClick={() => {
                setShareUrl("");
                setShareId("");
                setError(null);
              }}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              Generate New Link
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
