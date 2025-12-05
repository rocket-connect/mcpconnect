/* eslint-disable jsx-a11y/label-has-associated-control */
import React, { useState, useEffect } from "react";
import {
  X,
  Database,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Trash2,
  RotateCcw,
  Shield,
} from "lucide-react";
import {
  Neo4jConfigSection,
  Neo4jConnectionConfig,
  Neo4jSyncResult,
} from "./Neo4jConfigSection";

export type { Neo4jConnectionConfig, Neo4jSyncResult };

export type Neo4jSyncStatus = "idle" | "syncing" | "synced" | "stale" | "error";

export interface Neo4jSyncState {
  status: Neo4jSyncStatus;
  toolsetHash?: string;
  toolCount?: number;
  lastSyncTime?: number;
  error?: string;
  neo4jConfig?: Omit<Neo4jConnectionConfig, "password">;
  savedPassword?: string;
  rememberPassword?: boolean;
}

export interface Neo4jSyncOptions {
  config: Neo4jConnectionConfig;
  rememberPassword: boolean;
  openaiApiKey?: string;
}

export interface Neo4jConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSync: (options: Neo4jSyncOptions) => Promise<Neo4jSyncResult>;
  onResync?: (options: Neo4jSyncOptions) => Promise<Neo4jSyncResult>;
  onDelete?: () => Promise<void>;
  onReset?: () => Promise<void>;
  toolCount?: number;
  connectionName?: string;
  isOpenAIConfigured?: boolean;
  /** OpenAI API key for generating vector embeddings */
  openaiApiKey?: string;
  /** Current sync state from storage */
  syncState?: Neo4jSyncState;
  /** Initial config to populate form (from storage) */
  initialConfig?: Omit<Neo4jConnectionConfig, "password">;
}

export const Neo4jConnectionModal: React.FC<Neo4jConnectionModalProps> = ({
  isOpen,
  onClose,
  onSync,
  onResync,
  onDelete,
  onReset,
  toolCount = 0,
  connectionName = "Connection",
  isOpenAIConfigured = true,
  openaiApiKey,
  syncState,
  initialConfig,
}) => {
  const [formData, setFormData] = useState<Neo4jConnectionConfig>({
    uri: initialConfig?.uri || "neo4j://localhost:7687",
    username: initialConfig?.username || "neo4j",
    password: "",
    database: initialConfig?.database || "neo4j",
  });
  const [rememberPassword, setRememberPassword] = useState(
    syncState?.rememberPassword ?? false
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Decode saved password if available
  const decodeSavedPassword = (encoded?: string): string => {
    if (!encoded) return "";
    try {
      return atob(encoded);
    } catch {
      return "";
    }
  };

  // Update form data when initial config or saved password changes
  useEffect(() => {
    if (initialConfig || syncState?.savedPassword) {
      setFormData(prev => ({
        ...prev,
        uri: initialConfig?.uri || prev.uri,
        username: initialConfig?.username || prev.username,
        database: initialConfig?.database || prev.database,
        password: syncState?.savedPassword
          ? decodeSavedPassword(syncState.savedPassword)
          : prev.password,
      }));
      setRememberPassword(syncState?.rememberPassword ?? false);
    }
  }, [initialConfig, syncState?.savedPassword, syncState?.rememberPassword]);

  if (!isOpen) return null;

  const isSynced = syncState?.status === "synced";
  const isStale = syncState?.status === "stale";
  const hasError = syncState?.status === "error";

  const handleTestConnection = async (): Promise<boolean> => {
    console.log("[Neo4jConnectionModal] Testing connection:", {
      uri: formData.uri,
      username: formData.username,
      database: formData.database,
    });

    // Simulate async operation - in real implementation this would call the backend
    await new Promise(resolve => setTimeout(resolve, 1500));

    // For now, always succeed (mocked)
    console.log("[Neo4jConnectionModal] Connection test successful (mocked)");
    return true;
  };

  const handleSync = async (): Promise<Neo4jSyncResult> => {
    setIsSyncing(true);
    setLocalError(null);
    console.log("[Neo4jConnectionModal] Starting sync:", {
      config: { ...formData, password: "***" },
      rememberPassword,
      toolCount,
      hasOpenAIKey: !!openaiApiKey,
    });

    try {
      const result = await onSync({
        config: formData,
        rememberPassword,
        openaiApiKey,
      });
      console.log("[Neo4jConnectionModal] Sync complete:", result);
      setIsSyncing(false);
      onClose();
      return result;
    } catch (error) {
      console.error("[Neo4jConnectionModal] Sync failed:", error);
      setLocalError(error instanceof Error ? error.message : "Sync failed");
      setIsSyncing(false);
      throw error;
    }
  };

  const handleResync = async (): Promise<Neo4jSyncResult> => {
    if (!onResync) {
      return handleSync();
    }

    setIsSyncing(true);
    setLocalError(null);
    console.log("[Neo4jConnectionModal] Starting resync:", {
      config: { ...formData, password: "***" },
      rememberPassword,
      toolCount,
      hasOpenAIKey: !!openaiApiKey,
    });

    try {
      const result = await onResync({
        config: formData,
        rememberPassword,
        openaiApiKey,
      });
      console.log("[Neo4jConnectionModal] Resync complete:", result);
      setIsSyncing(false);
      onClose();
      return result;
    } catch (error) {
      console.error("[Neo4jConnectionModal] Resync failed:", error);
      setLocalError(error instanceof Error ? error.message : "Resync failed");
      setIsSyncing(false);
      throw error;
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;

    setIsDeleting(true);
    setLocalError(null);
    console.log("[Neo4jConnectionModal] Deleting sync data");

    try {
      await onDelete();
      console.log("[Neo4jConnectionModal] Delete complete");
      setIsDeleting(false);
      onClose();
    } catch (error) {
      console.error("[Neo4jConnectionModal] Delete failed:", error);
      setLocalError(error instanceof Error ? error.message : "Delete failed");
      setIsDeleting(false);
    }
  };

  const handleReset = async () => {
    if (!onReset) return;

    setIsResetting(true);
    setLocalError(null);
    console.log("[Neo4jConnectionModal] Resetting all sync data");

    try {
      await onReset();
      console.log("[Neo4jConnectionModal] Reset complete");
      setIsResetting(false);
      setShowResetConfirm(false);
      // Reset form to defaults
      setFormData({
        uri: "neo4j://localhost:7687",
        username: "neo4j",
        password: "",
        database: "neo4j",
      });
      setRememberPassword(false);
      onClose();
    } catch (error) {
      console.error("[Neo4jConnectionModal] Reset failed:", error);
      setLocalError(error instanceof Error ? error.message : "Reset failed");
      setIsResetting(false);
    }
  };

  const handleClose = () => {
    if (!isSyncing && !isDeleting && !isResetting) {
      setFormData({
        uri: initialConfig?.uri || "neo4j://localhost:7687",
        username: initialConfig?.username || "neo4j",
        password: syncState?.savedPassword
          ? decodeSavedPassword(syncState.savedPassword)
          : "",
        database: initialConfig?.database || "neo4j",
      });
      setLocalError(null);
      setShowResetConfirm(false);
      onClose();
    }
  };

  const formatLastSync = (timestamp?: number) => {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {isSynced ? "Vector Search Settings" : "Set Up Vector Search"}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Connect to Neo4j for {connectionName}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isSyncing || isDeleting}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Sync Status Banner */}
        {(isSynced || isStale || hasError) && (
          <div className="px-6 pt-4">
            {isSynced && (
              <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                    Vector search is active
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                    {syncState?.toolCount} tools synced
                    {syncState?.lastSyncTime && (
                      <>
                        {" "}
                        • Last synced: {formatLastSync(syncState.lastSyncTime)}
                      </>
                    )}
                  </p>
                  {syncState?.toolsetHash && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-mono truncate">
                      Hash: {syncState.toolsetHash}
                    </p>
                  )}
                </div>
              </div>
            )}

            {isStale && (
              <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Schema has changed
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    Tools have been modified since last sync. Resync to update
                    vector embeddings.
                  </p>
                </div>
              </div>
            )}

            {hasError && (
              <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    Sync failed
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                    {syncState?.error || "An error occurred during sync"}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="p-6">
          <Neo4jConfigSection
            config={formData}
            onConfigChange={setFormData}
            onTestConnection={handleTestConnection}
            onSync={isSynced || isStale ? handleResync : handleSync}
            toolCount={toolCount}
            isSyncing={isSyncing}
            isOpenAIConfigured={isOpenAIConfigured}
            syncStatus={syncState?.status}
            currentHash={syncState?.toolsetHash}
            syncError={localError || syncState?.error}
          />

          {/* Remember Password Checkbox */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={rememberPassword}
                onChange={e => setRememberPassword(e.target.checked)}
                className="mt-1 w-4 h-4 text-purple-600 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-purple-500 focus:ring-2"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                    Remember password
                  </span>
                  <Shield className="w-3.5 h-3.5 text-gray-400" />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Save password locally for automatic reconnection on page
                  refresh. Password is stored encoded in browser storage.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Reset Confirmation Dialog */}
        {showResetConfirm && (
          <div className="px-6 pb-4">
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    Reset all vector search data?
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                    This will delete all synced tool embeddings from Neo4j and
                    clear saved credentials. You will need to re-sync to use
                    semantic tool search.
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={handleReset}
                      disabled={isResetting}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors disabled:opacity-50"
                    >
                      {isResetting ? "Resetting..." : "Yes, Reset Everything"}
                    </button>
                    <button
                      onClick={() => setShowResetConfirm(false)}
                      disabled={isResetting}
                      className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer with actions */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            {(isSynced || isStale || hasError) && onDelete && (
              <button
                onClick={handleDelete}
                disabled={isSyncing || isDeleting || isResetting}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {isDeleting ? "Removing..." : "Delete Toolset"}
              </button>
            )}
            {(isSynced || isStale || hasError) &&
              onReset &&
              !showResetConfirm && (
                <button
                  onClick={() => setShowResetConfirm(true)}
                  disabled={isSyncing || isDeleting || isResetting}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset All
                </button>
              )}
          </div>
          <div className="flex items-center gap-3">
            {(isSynced || isStale) && (
              <button
                onClick={handleResync}
                disabled={
                  isSyncing || isDeleting || isResetting || !formData.password
                }
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-md transition-colors disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`}
                />
                {isSyncing ? "Syncing..." : "Resync"}
              </button>
            )}
            <button
              onClick={handleClose}
              disabled={isSyncing || isDeleting || isResetting}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50"
            >
              {isSynced ? "Close" : "Cancel"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
