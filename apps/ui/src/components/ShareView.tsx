// apps/ui/src/components/ShareView.tsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Share2,
  Download,
  AlertCircle,
  Loader,
  ExternalLink,
  MessageSquare,
  Settings,
  Users,
  CheckCircle,
  X,
  Key,
  Database,
} from "lucide-react";
import { useStorage } from "../contexts/StorageContext";
import { ShareService } from "../services/shareService";

export const ShareView: React.FC = () => {
  const { shareData } = useParams<{ shareData: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { adapter } = useStorage();

  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [isImported, setIsImported] = useState(false);

  const selectedTool = searchParams.get("tool");

  // Load share metadata on mount
  useEffect(() => {
    const loadShareMetadata = async () => {
      if (!shareData) {
        setError("Invalid share link - no data found");
        setIsLoading(false);
        return;
      }

      try {
        const meta = await ShareService.getShareMetadata(shareData);
        setMetadata(meta);
      } catch (err) {
        console.error("Failed to load share metadata:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load shared data"
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadShareMetadata();
  }, [shareData]);

  const handleImport = async () => {
    if (!shareData) return;

    setIsImporting(true);
    setError(null);

    try {
      const { connectionId, chatId } = await ShareService.importFromShareUrl(
        shareData,
        adapter
      );

      setIsImported(true);

      // Show success message and then reload
      // The ShareService will handle the reload automatically
      setTimeout(() => {
        let targetUrl = `/connections/${connectionId}/chat/${chatId}`;
        if (selectedTool) {
          targetUrl += `/tools/${selectedTool}`;
        }
        // Try to navigate first, but the reload will happen anyway
        try {
          navigate(targetUrl);
        } catch (navError) {
          console.log("Navigation attempted, reload will complete the process");
        }
      }, 1500);
    } catch (err) {
      console.error("Failed to import share:", err);
      setError(
        err instanceof Error ? err.message : "Failed to import shared chat"
      );
      setIsImporting(false);
    }
  };

  const handleDecline = () => {
    navigate("/connections");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Loading shared chat...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-lg mx-auto mb-4 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Invalid Share Link
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
            <button
              onClick={() => navigate("/connections")}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Go to Connections
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isImported) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg mx-auto mb-4 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Chat Imported Successfully!
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              The complete shared chat with all content has been added to your
              MCPConnect. Reloading to ensure everything is properly loaded...
            </p>
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 dark:bg-blue-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Share2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">
                Shared Chat Session
              </h1>
              <p className="text-blue-100 text-sm">
                Complete chat session with all content and credentials
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Shared Content Preview */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Complete Chat Preview
            </h3>

            <div className="space-y-4">
              {/* Connection Info */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <ExternalLink className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {metadata?.connectionName}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    MCP Connection with Complete Configuration
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Settings className="w-3 h-3" />
                      {metadata?.toolCount} tools available
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {metadata?.messageCount} messages
                    </span>
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
                    {metadata?.conversationTitle}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Shared by {metadata?.sharedBy} on{" "}
                    {new Date(metadata?.timestamp).toLocaleDateString()}
                  </p>
                  {selectedTool && (
                    <div className="mt-2 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded text-xs">
                      Tool selected: {selectedTool}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* What will be imported */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
              <Download className="w-4 h-4" />
              Complete content that will be imported:
            </h3>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>
                • Complete conversation with {metadata?.messageCount} messages
                and all metadata
              </li>
              <li>
                • Full connection "{metadata?.connectionName}" with ALL
                credentials and headers
              </li>
              <li>
                • All {metadata?.toolCount} tools with complete configuration
                and settings
              </li>
              <li>
                • Complete tool execution history with all results and data
              </li>
              <li>• Tool enablement settings and preferences</li>
              {selectedTool && <li>• Selected tool will open in inspector</li>}
            </ul>
          </div>

          {/* Complete Data Notice */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
            <div className="flex items-start gap-2">
              <Key className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-green-900 dark:text-green-100">
                  Complete Data Transfer
                </h4>
                <p className="text-sm text-green-800 dark:text-green-200 mt-1">
                  This share includes ALL connection data including API keys,
                  authentication headers, and credentials. The imported
                  connection will be fully functional with all original settings
                  preserved.
                </p>
              </div>
            </div>
          </div>

          {/* Auto-reload Notice */}
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-2">
              <Database className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  Automatic Reload
                </h4>
                <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                  After importing, MCPConnect will automatically reload to
                  ensure all shared content is properly loaded and displayed.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleImport}
              disabled={isImporting}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isImporting ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Importing Complete Chat...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Import Complete Chat Session
                </>
              )}
            </button>
            <button
              onClick={handleDecline}
              disabled={isImporting}
              className="flex items-center gap-2 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-4 h-4" />
              Decline
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Users className="w-4 h-4" />
            <span>
              This complete shared session will be added to your local
              MCPConnect storage with all credentials and settings intact
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
