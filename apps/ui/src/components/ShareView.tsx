// apps/ui/src/components/ShareView.tsx - FIXED VERSION
import React, { useState, useEffect, useRef } from "react";
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

  // Use refs to prevent race conditions
  const isImportingRef = useRef(false);
  const hasImportedRef = useRef(false);
  const importPromiseRef = useRef<Promise<any> | null>(null);

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
        console.log(
          `[ShareView] Loading share data: ${shareData.substring(0, 50)}...`
        );

        // Try new minimal format first, fallback to old format
        let meta;
        try {
          meta = await ShareService.getMinimalShareMetadata(shareData);
          console.log(`[ShareView] Loaded minimal share metadata:`, meta);
        } catch (minimalError) {
          console.warn(
            `[ShareView] Failed to load as minimal share, trying legacy format:`,
            minimalError
          );
          // Try legacy format here if needed
          throw minimalError;
        }

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

    // Prevent multiple simultaneous imports
    if (isImportingRef.current || hasImportedRef.current) {
      console.log("Import already in progress or completed");
      return;
    }

    // If there's already an import promise, wait for it
    if (importPromiseRef.current) {
      try {
        await importPromiseRef.current;
        return;
      } catch (error) {
        // Continue with new import if previous failed
        importPromiseRef.current = null;
      }
    }

    setIsImporting(true);
    setError(null);
    isImportingRef.current = true;

    // Create and store the import promise
    const importPromise = (async () => {
      try {
        console.log(
          `[ShareView] Starting import for share data: ${shareData.substring(0, 50)}...`
        );

        const { connectionId, chatId } = await ShareService.importMinimalShare(
          shareData,
          adapter
        );

        console.log(
          `[ShareView] Import successful: connection=${connectionId}, chat=${chatId}`
        );

        // Mark as successfully imported
        hasImportedRef.current = true;
        setIsImported(true);

        // Build target URL
        let targetUrl = `/connections/${connectionId}/chat/${chatId}`;
        if (selectedTool) {
          targetUrl += `/tools/${selectedTool}`;
        }

        console.log(`[ShareView] Will navigate to: ${targetUrl}`);

        // Show success for a moment, then reload
        setTimeout(() => {
          // Store the target URL before reload so we can navigate after
          sessionStorage.setItem("mcpconnect-import-target", targetUrl);
          console.log(`[ShareView] Stored target URL and reloading...`);
          window.location.reload();
        }, 1500);

        return { connectionId, chatId };
      } catch (err) {
        console.error("Failed to import share:", err);
        hasImportedRef.current = false;
        isImportingRef.current = false;

        const errorMessage =
          err instanceof Error ? err.message : "Failed to import shared chat";
        setError(errorMessage);
        setIsImporting(false);

        throw err;
      }
    })();

    importPromiseRef.current = importPromise;

    try {
      await importPromise;
    } catch (error) {
      // Error already handled above
    } finally {
      importPromiseRef.current = null;
    }
  };

  const handleDecline = () => {
    // Prevent navigation if import is in progress
    if (isImportingRef.current) {
      return;
    }
    navigate("/connections");
  };

  // Handle post-reload navigation
  useEffect(() => {
    const targetUrl = sessionStorage.getItem("mcpconnect-import-target");
    if (targetUrl) {
      console.log(`[ShareView] Found stored target URL: ${targetUrl}`);
      sessionStorage.removeItem("mcpconnect-import-target");
      navigate(targetUrl, { replace: true });
    }
  }, [navigate]);

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
              The shared chat with {metadata?.toolCount || 0} working tools has
              been imported. Reloading to display your new chat...
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
                Compact share with {metadata?.toolCount || 0} working tools
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Shared Content Preview */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Ready-to-Use Chat Preview
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
                    MCP Connection with {metadata?.toolCount || 0} Working Tools
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Settings className="w-3 h-3" />
                      {metadata?.toolCount || 0} tools (all enabled)
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {metadata?.messageCount || 0} messages
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
                    Shared on{" "}
                    {new Date(metadata?.timestamp).toLocaleDateString()}
                  </p>
                  {selectedTool && (
                    <div className="mt-2 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded text-xs">
                      Tool highlighted: {selectedTool}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Compact Share Benefits */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
            <h3 className="text-sm font-medium text-green-900 dark:text-green-100 mb-2 flex items-center gap-2">
              <Download className="w-4 h-4" />
              Optimized sharing includes:
            </h3>
            <ul className="text-sm text-green-800 dark:text-green-200 space-y-1">
              <li>• Complete working setup - no configuration needed</li>
              <li>• {metadata?.toolCount || 0} ready-to-use tools</li>
              <li>
                • Full conversation history ({metadata?.messageCount || 0}{" "}
                messages)
              </li>
              <li>• All necessary authentication credentials</li>
              {selectedTool && <li>• Selected tool will open in inspector</li>}
            </ul>
          </div>

          {/* Instant Setup Notice */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Instant Setup
                </h4>
                <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                  This compact share contains only essential data and working
                  tools. Everything will be ready immediately after import.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleImport}
              disabled={isImporting || isImported}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isImporting ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Importing Chat...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Import Working Chat
                </>
              )}
            </button>
            <button
              onClick={handleDecline}
              disabled={isImporting || isImported}
              className="flex items-center gap-2 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
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
              This chat session will be added to your MCPConnect with
              {metadata?.toolCount || 0} working tools enabled
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
