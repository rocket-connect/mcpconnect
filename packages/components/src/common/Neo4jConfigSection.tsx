/* eslint-disable jsx-a11y/label-has-associated-control */
import React, { useState } from "react";
import {
  Database,
  Loader,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Sparkles,
  HelpCircle,
} from "lucide-react";

export interface Neo4jConnectionConfig {
  uri: string;
  username: string;
  password: string;
  database?: string;
}

export interface Neo4jSyncResult {
  hash: string;
  toolCount: number;
}

export interface Neo4jConfigSectionProps {
  /** Current configuration values */
  config: Neo4jConnectionConfig;
  /** Callback when configuration changes */
  onConfigChange: (config: Neo4jConnectionConfig) => void;
  /** Callback when test connection is clicked */
  onTestConnection: () => Promise<boolean>;
  /** Callback when sync is clicked - returns hash and tool count on success */
  onSync: () => Promise<Neo4jSyncResult>;
  /** Number of tools available to vectorize */
  toolCount?: number;
  /** Whether sync is in progress */
  isSyncing?: boolean;
  /** Whether the section is in a compact mode (for embedded use) */
  compact?: boolean;
  /** Whether OpenAI is configured (required for embeddings) */
  isOpenAIConfigured?: boolean;
  /** Current sync status */
  syncStatus?: "idle" | "syncing" | "synced" | "stale" | "error";
  /** Last known toolset hash */
  currentHash?: string;
  /** Error message from last sync attempt */
  syncError?: string;
}

export const Neo4jConfigSection: React.FC<Neo4jConfigSectionProps> = ({
  config,
  onConfigChange,
  onTestConnection,
  onSync,
  toolCount = 0,
  isSyncing = false,
  compact = false,
  isOpenAIConfigured = false,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [testStatus, setTestStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [testError, setTestError] = useState<string | null>(null);

  const handleInputChange = (
    field: keyof Neo4jConnectionConfig,
    value: string
  ) => {
    onConfigChange({ ...config, [field]: value });
    setTestStatus("idle");
    setTestError(null);
  };

  const handleTestConnection = async () => {
    if (!config.uri || !config.username || !config.password) {
      setTestError("Please fill in all required fields");
      setTestStatus("error");
      return;
    }

    setTestStatus("testing");
    setTestError(null);

    try {
      const success = await onTestConnection();
      setTestStatus(success ? "success" : "error");
      if (!success) {
        setTestError("Connection failed. Please check your credentials.");
      }
    } catch (error) {
      setTestStatus("error");
      setTestError(
        error instanceof Error ? error.message : "Connection test failed"
      );
    }
  };

  const handleSync = async () => {
    if (testStatus !== "success") {
      setTestError("Please test the connection first");
      return;
    }

    await onSync();
  };

  // Show warning if OpenAI is not configured
  if (!isOpenAIConfigured) {
    return (
      <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
        <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            OpenAI Required for Vector Search
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            Semantic tool search requires OpenAI for generating embeddings.
            Please configure OpenAI as your AI provider above to enable this
            feature.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      {!compact && (
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-purple-800 dark:text-purple-200">
                Index <strong>{toolCount} tools</strong> into Neo4j using vector
                embeddings for semantic search to find the most relevant tools
                for each prompt.
              </p>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                Requires Neo4j 5.11+ with vector index support
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Connection Form */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
          <Database className="w-4 h-4 text-purple-500" />
          Neo4j Connection
          <a
            href="https://neo4j.com/docs/aura/aurads/getting-started/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-600 hover:text-purple-700 dark:text-purple-400"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </a>
        </h4>

        {/* URI */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Connection URI *
          </label>
          <input
            type="text"
            value={config.uri}
            onChange={e => handleInputChange("uri", e.target.value)}
            placeholder="neo4j://localhost:7687 or neo4j+s://xxx.databases.neo4j.io"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Use neo4j+s:// for Aura cloud instances
          </p>
        </div>

        {/* Username & Password */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Username *
            </label>
            <input
              type="text"
              value={config.username}
              onChange={e => handleInputChange("username", e.target.value)}
              placeholder="neo4j"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Password *
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={config.password}
                onChange={e => handleInputChange("password", e.target.value)}
                placeholder="your-password"
                className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Database */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Database (optional)
          </label>
          <input
            type="text"
            value={config.database || ""}
            onChange={e => handleInputChange("database", e.target.value)}
            placeholder="neo4j"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
          />
        </div>
      </div>

      {/* Test Connection */}
      <div className="space-y-3">
        <button
          onClick={handleTestConnection}
          disabled={testStatus === "testing" || isSyncing}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium border border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 rounded-md hover:bg-purple-50 dark:hover:bg-purple-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {testStatus === "testing" ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Testing Connection...
            </>
          ) : (
            <>
              <Database className="w-4 h-4" />
              Test Connection
            </>
          )}
        </button>

        {/* Status Messages */}
        {testStatus === "success" && (
          <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
            <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="text-sm text-green-800 dark:text-green-200">
              Connection successful! Ready to sync.
            </span>
          </div>
        )}

        {testStatus === "error" && testError && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <span className="text-sm text-red-800 dark:text-red-200">
              {testError}
            </span>
          </div>
        )}
      </div>

      {/* Sync Button */}
      <button
        onClick={handleSync}
        disabled={testStatus !== "success" || isSyncing}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
      >
        {isSyncing ? (
          <>
            <Loader className="w-4 h-4 animate-spin" />
            Syncing {toolCount} tools...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Sync & Enable Vector Search
          </>
        )}
      </button>
    </div>
  );
};
