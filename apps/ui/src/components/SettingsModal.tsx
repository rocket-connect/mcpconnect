/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Brain,
  Trash2,
  Database,
  AlertCircle,
  CheckCircle,
  Loader,
  Sparkles,
  Zap,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  RotateCcw,
  Shield,
} from "lucide-react";
import {
  ModelService,
  LLMSettings,
  ModelOption,
  ModelProvider,
} from "../services/modelService";
import { useStorage } from "../contexts/StorageContext";
import { Neo4jConfigSection } from "@mcpconnect/components";
import { useNeo4jSync } from "../hooks/useNeo4jSync";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-select a connection and auto-open its Neo4j sync modal */
  preSelectedConnectionId?: string;
}

const defaultSettings: LLMSettings = {
  provider: "anthropic",
  apiKey: "",
  model: "claude-sonnet-4-20250514",
  baseUrl: "",
  temperature: 0.7,
  maxTokens: 4096,
};

const providerOptions = [
  {
    value: "anthropic" as const,
    label: "Anthropic",
    logo: "/anthropic-logo.svg",
  },
  {
    value: "openai" as const,
    label: "OpenAI",
    logo: "/openai-logo.svg",
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  preSelectedConnectionId,
}) => {
  const { adapter } = useStorage();
  const [settings, setSettings] = useState<LLMSettings>(defaultSettings);
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<
    "idle" | "testing" | "valid" | "invalid"
  >("idle");
  const [storageStats, setStorageStats] = useState({
    connections: 0,
    totalConversations: 0,
    totalToolExecutions: 0,
    totalTools: 0,
    totalResources: 0,
  });

  // Get Neo4j sync states for all connections
  const { connections, getNeo4jSyncState, tools } = useStorage();

  // State for managing Neo4j per connection (inline expanded view)
  const [expandedConnectionId, setExpandedConnectionId] = useState<
    string | null
  >(null);
  const [rememberPassword, setRememberPassword] = useState(false);
  const [neo4jFormData, setNeo4jFormData] = useState({
    uri: "neo4j://localhost:7687",
    username: "neo4j",
    password: "",
    database: "neo4j",
  });
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Use Neo4j sync hook for expanded connection
  const {
    syncState: expandedSyncState,
    handleSync,
    handleResync,
    handleDelete,
    handleReset,
  } = useNeo4jSync(expandedConnectionId || undefined);

  // Count connections with active vector search
  const vectorizedConnectionsCount = connections.filter(
    conn => getNeo4jSyncState(conn.id)?.status === "synced"
  ).length;

  // Get tool count for expanded connection
  const expandedConnectionToolCount = expandedConnectionId
    ? (tools[expandedConnectionId] || []).length
    : 0;

  // Decode saved password if available
  const decodeSavedPassword = (encoded?: string): string => {
    if (!encoded) return "";
    try {
      return atob(encoded);
    } catch {
      return "";
    }
  };

  // Update form data when expanded connection changes
  useEffect(() => {
    if (expandedConnectionId && expandedSyncState) {
      const config = expandedSyncState.neo4jConfig;
      setNeo4jFormData({
        uri: config?.uri || "neo4j://localhost:7687",
        username: config?.username || "neo4j",
        password: expandedSyncState.savedPassword
          ? decodeSavedPassword(expandedSyncState.savedPassword)
          : "",
        database: config?.database || "neo4j",
      });
      setRememberPassword(expandedSyncState.rememberPassword ?? false);
    } else if (expandedConnectionId) {
      // Reset form for new connection
      setNeo4jFormData({
        uri: "neo4j://localhost:7687",
        username: "neo4j",
        password: "",
        database: "neo4j",
      });
      setRememberPassword(false);
    }
    setShowResetConfirm(false);
  }, [
    expandedConnectionId,
    expandedSyncState?.neo4jConfig,
    expandedSyncState?.savedPassword,
  ]);

  // Load settings from adapter on mount
  useEffect(() => {
    if (isOpen && adapter) {
      loadSettings();
      calculateStorageStats();
    }
  }, [isOpen, adapter]);

  // Auto-expand connection when preSelectedConnectionId is provided
  useEffect(() => {
    if (isOpen && preSelectedConnectionId) {
      setExpandedConnectionId(preSelectedConnectionId);
    }
  }, [isOpen, preSelectedConnectionId]);

  const loadSettings = async () => {
    setIsLoadingSettings(true);
    try {
      const savedSettings = await ModelService.loadSettings();
      if (savedSettings) {
        setSettings({ ...defaultSettings, ...savedSettings });
      } else {
        // Set default settings for the default provider
        const providerDefaults = ModelService.getDefaultSettings("anthropic");
        setSettings(prev => ({ ...prev, ...providerDefaults }));
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
      // Fall back to defaults
      const providerDefaults = ModelService.getDefaultSettings("anthropic");
      setSettings(prev => ({ ...prev, ...providerDefaults }));
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const loadAvailableModels = useCallback(async () => {
    setIsLoadingModels(true);
    try {
      // Load static models immediately (AISDKAdapter handles this)
      const staticModels = ModelService.getAvailableModels(settings.provider);
      setAvailableModels(staticModels);

      // Try to fetch dynamic models if API key is available
      if (settings.apiKey) {
        try {
          const dynamicModels = await ModelService.fetchModelsFromAPI(
            settings.provider,
            settings.apiKey,
            settings.baseUrl
          );
          setAvailableModels(dynamicModels);
        } catch (error) {
          console.warn("Failed to fetch dynamic models, using static list");
        }
      }
    } catch (error) {
      console.error("Failed to load models:", error);
    } finally {
      setIsLoadingModels(false);
    }
  }, [settings.provider, settings.apiKey, settings.baseUrl]);

  // Load models when provider or API credentials change
  useEffect(() => {
    if (isOpen) {
      loadAvailableModels();
    }
  }, [
    settings.provider,
    settings.apiKey,
    settings.baseUrl,
    isOpen,
    loadAvailableModels,
  ]);

  const calculateStorageStats = async () => {
    try {
      const stats = await adapter.getMCPStats();
      setStorageStats(stats);
    } catch (error) {
      console.error("Failed to calculate storage stats:", error);
    }
  };

  const testApiKey = async () => {
    if (!settings.apiKey) {
      setApiKeyStatus("invalid");
      return;
    }

    setApiKeyStatus("testing");
    try {
      // Use the adapter's testApiKey method
      const isValid = await ModelService.testApiKey(
        settings.provider,
        settings.apiKey,
        settings.baseUrl
      );
      setApiKeyStatus(isValid ? "valid" : "invalid");

      // If key is valid, reload models to get the latest list
      if (isValid) {
        loadAvailableModels();
      }
    } catch (error) {
      console.error("API key test failed:", error);
      setApiKeyStatus("invalid");
    }
  };

  const handleSettingChange = <K extends keyof LLMSettings>(
    key: K,
    value: LLMSettings[K]
  ) => {
    setSettings(prev => {
      const newSettings = { ...prev, [key]: value };

      // Reset API key status when credentials change
      if (key === "apiKey" || key === "baseUrl" || key === "provider") {
        setApiKeyStatus("idle");
      }

      // Load provider defaults when switching providers
      if (key === "provider") {
        const providerDefaults = ModelService.getDefaultSettings(
          value as ModelProvider
        );
        return { ...newSettings, ...providerDefaults };
      }

      return newSettings;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await ModelService.saveSettings(settings);
      onClose();
    } catch (error) {
      console.error("Failed to save settings:", error);
      alert("Failed to save settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearStorage = async () => {
    if (
      confirm(
        "Are you sure you want to clear all MCPConnect data? This cannot be undone."
      )
    ) {
      try {
        await adapter.clearAllMCPData();
        await calculateStorageStats();

        // Show confirmation
        alert("Local storage cleared successfully. The page will reload.");
        window.location.reload();
      } catch (error) {
        console.error("Failed to clear storage:", error);
        alert("Failed to clear storage. Please try again.");
      }
    }
  };

  const getApiKeyStatusIcon = () => {
    switch (apiKeyStatus) {
      case "testing":
        return <Loader className="w-4 h-4 animate-spin text-blue-500" />;
      case "valid":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "invalid":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const isApiKeyFormatValid = settings.apiKey
    ? ModelService.validateApiKeyFormat(settings.provider, settings.apiKey)
    : true;

  const currentProvider = providerOptions.find(
    p => p.value === settings.provider
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Settings
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Loading State */}
          {isLoadingSettings && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">
                Loading settings...
              </span>
            </div>
          )}

          {!isLoadingSettings && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Brain className="w-4 h-4" />
                LLM Configuration
              </h3>

              <div className="space-y-4">
                {/* Provider Selection with Logos */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    AI Provider
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {providerOptions.map(provider => (
                      <button
                        key={provider.value}
                        type="button"
                        onClick={() =>
                          handleSettingChange("provider", provider.value)
                        }
                        className={`flex items-center gap-3 p-3 border-2 rounded-lg transition-all ${
                          settings.provider === provider.value
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                            : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                        }`}
                      >
                        <img
                          src={provider.logo}
                          alt={`${provider.label} logo`}
                          className="w-8 h-8 object-contain invert dark:invert-0"
                          onError={e => {
                            // Fallback if logo doesn't load
                            e.currentTarget.style.display = "none";
                          }}
                        />
                        <span
                          className={`text-sm font-medium ${
                            settings.provider === provider.value
                              ? "text-blue-700 dark:text-blue-300"
                              : "text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {provider.label}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Select your preferred AI provider
                  </p>
                </div>

                {/* Model Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Model
                    {isLoadingModels && (
                      <span className="ml-2 text-xs text-gray-500">
                        Loading...
                      </span>
                    )}
                  </label>
                  <select
                    value={settings.model}
                    onChange={e => handleSettingChange("model", e.target.value)}
                    disabled={isLoadingModels}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {availableModels.map(option => (
                      <option
                        key={option.value}
                        value={option.value}
                        title={option.description}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {/* Show model description */}
                  {availableModels.find(m => m.value === settings.model)
                    ?.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {
                        availableModels.find(m => m.value === settings.model)
                          ?.description
                      }
                    </p>
                  )}
                </div>

                {/* API Key */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    {currentProvider && (
                      <img
                        src={currentProvider.logo}
                        alt={`${currentProvider.label} logo`}
                        className="w-4 h-4 object-contain invert dark:invert-0"
                        onError={e => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    )}
                    {ModelService.getProviderDisplayName(settings.provider)} API
                    Key
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={settings.apiKey}
                      onChange={e =>
                        handleSettingChange("apiKey", e.target.value)
                      }
                      placeholder={ModelService.getApiKeyPlaceholder(
                        settings.provider
                      )}
                      className={`w-full px-3 py-2 pr-20 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        !isApiKeyFormatValid
                          ? "border-red-300 dark:border-red-600"
                          : "border-gray-300 dark:border-gray-600"
                      }`}
                    />
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                      {getApiKeyStatusIcon()}
                      <button
                        onClick={testApiKey}
                        disabled={!settings.apiKey}
                        className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800/50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Test
                      </button>
                    </div>
                  </div>
                  {!isApiKeyFormatValid && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      Invalid API key format for{" "}
                      {ModelService.getProviderDisplayName(settings.provider)}
                    </p>
                  )}
                  {apiKeyStatus === "invalid" && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      API key test failed. Please check your key and try again.
                    </p>
                  )}
                  {apiKeyStatus === "valid" && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      API key is valid
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Vector Search Section - Only show when OpenAI is selected AND a connection is pre-selected */}
          {!isLoadingSettings &&
            settings.provider === "openai" &&
            preSelectedConnectionId && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  Vector Search
                  {vectorizedConnectionsCount > 0 && (
                    <span className="ml-2 inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                      <Zap className="w-3 h-3" />
                      {vectorizedConnectionsCount} Active
                    </span>
                  )}
                </h3>

                {(() => {
                  // Find the selected connection
                  const selectedConnection = connections.find(
                    c => c.id === preSelectedConnectionId
                  );
                  if (!selectedConnection) {
                    return (
                      <div className="text-center py-6 text-sm text-gray-500 dark:text-gray-400">
                        Connection not found.
                      </div>
                    );
                  }

                  // Only show the selected connection
                  const conn = selectedConnection;
                  const syncState = getNeo4jSyncState(conn.id);
                  const toolCount = (tools[conn.id] || []).length;
                  const status = syncState?.status || "idle";
                  const isExpanded = expandedConnectionId === conn.id;

                  return (
                    <div
                      key={conn.id}
                      className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
                    >
                      {/* Connection Header - clickable to expand/collapse */}
                      <button
                        onClick={() =>
                          setExpandedConnectionId(isExpanded ? null : conn.id)
                        }
                        className="w-full flex items-center justify-between gap-3 p-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {status === "synced" ? (
                            <div className="w-6 h-6 bg-green-500 rounded flex items-center justify-center flex-shrink-0">
                              <Zap className="w-3.5 h-3.5 text-white" />
                            </div>
                          ) : status === "stale" ? (
                            <div className="w-6 h-6 bg-amber-500 rounded flex items-center justify-center flex-shrink-0">
                              <AlertCircle className="w-3.5 h-3.5 text-white" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded flex items-center justify-center flex-shrink-0">
                              <Database className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                            </div>
                          )}
                          <div className="min-w-0 text-left">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {conn.name}
                            </p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">
                              {toolCount} tools
                              {status === "synced" && syncState?.toolCount && (
                                <span className="text-green-600 dark:text-green-400">
                                  {" "}
                                  • {syncState.toolCount} synced
                                </span>
                              )}
                              {status === "stale" && (
                                <span className="text-amber-600 dark:text-amber-400">
                                  {" "}
                                  • needs resync
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {status === "synced" ? "Manage" : "Set Up"}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </button>

                      {/* Expanded Configuration Section */}
                      {isExpanded && (
                        <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-4">
                          {/* Sync Status Banner */}
                          {(status === "synced" ||
                            status === "stale" ||
                            status === "error") && (
                            <div>
                              {status === "synced" && (
                                <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                                      Vector search is active
                                    </p>
                                    <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                                      {expandedSyncState?.toolCount} tools
                                      synced
                                      {expandedSyncState?.lastSyncTime && (
                                        <>
                                          {" "}
                                          • Last synced:{" "}
                                          {new Date(
                                            expandedSyncState.lastSyncTime
                                          ).toLocaleString()}
                                        </>
                                      )}
                                    </p>
                                  </div>
                                </div>
                              )}

                              {status === "stale" && (
                                <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                                      Schema has changed
                                    </p>
                                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                                      Tools have been modified since last sync.
                                      Resync to update vector embeddings.
                                    </p>
                                  </div>
                                </div>
                              )}

                              {status === "error" && (
                                <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-red-800 dark:text-red-200">
                                      Sync failed
                                    </p>
                                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                                      {expandedSyncState?.error ||
                                        "An error occurred during sync"}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Neo4j Config Form */}
                          <Neo4jConfigSection
                            config={neo4jFormData}
                            onConfigChange={config =>
                              setNeo4jFormData({
                                ...config,
                                database: config.database || "neo4j",
                              })
                            }
                            onTestConnection={async () => {
                              // Simulate connection test
                              await new Promise(resolve =>
                                setTimeout(resolve, 1500)
                              );
                              return true;
                            }}
                            onSync={async () => {
                              const isSynced =
                                status === "synced" || status === "stale";
                              const syncFn = isSynced
                                ? handleResync
                                : handleSync;
                              return await syncFn({
                                config: neo4jFormData,
                                rememberPassword,
                                openaiApiKey: settings.apiKey,
                              });
                            }}
                            toolCount={expandedConnectionToolCount}
                            isSyncing={expandedSyncState?.status === "syncing"}
                            isOpenAIConfigured={settings.provider === "openai"}
                            syncStatus={expandedSyncState?.status}
                            currentHash={expandedSyncState?.toolsetHash}
                            syncError={expandedSyncState?.error}
                            compact
                          />

                          {/* Remember Password Checkbox */}
                          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                            <label className="flex items-start gap-3 cursor-pointer group">
                              <input
                                type="checkbox"
                                checked={rememberPassword}
                                onChange={e =>
                                  setRememberPassword(e.target.checked)
                                }
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
                                  Save password locally for automatic
                                  reconnection.
                                </p>
                              </div>
                            </label>
                          </div>

                          {/* Reset Confirmation */}
                          {showResetConfirm && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                              <div className="flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                                    Reset all vector search data?
                                  </p>
                                  <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                                    This will delete all synced tool embeddings
                                    and clear saved credentials.
                                  </p>
                                  <div className="flex items-center gap-2 mt-3">
                                    <button
                                      onClick={async () => {
                                        setIsResetting(true);
                                        try {
                                          await handleReset();
                                          setShowResetConfirm(false);
                                        } finally {
                                          setIsResetting(false);
                                        }
                                      }}
                                      disabled={isResetting}
                                      className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors disabled:opacity-50"
                                    >
                                      {isResetting
                                        ? "Resetting..."
                                        : "Yes, Reset"}
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
                          )}

                          {/* Action Buttons for synced connections */}
                          {(status === "synced" ||
                            status === "stale" ||
                            status === "error") &&
                            !showResetConfirm && (
                              <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={async () => {
                                      setIsDeleting(true);
                                      try {
                                        await handleDelete();
                                      } finally {
                                        setIsDeleting(false);
                                      }
                                    }}
                                    disabled={isDeleting || isResetting}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    {isDeleting ? "Removing..." : "Delete"}
                                  </button>
                                  <button
                                    onClick={() => setShowResetConfirm(true)}
                                    disabled={isDeleting || isResetting}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Reset All
                                  </button>
                                </div>
                                {(status === "synced" ||
                                  status === "stale") && (
                                  <button
                                    onClick={async () => {
                                      await handleResync({
                                        config: neo4jFormData,
                                        rememberPassword,
                                        openaiApiKey: settings.apiKey,
                                      });
                                    }}
                                    disabled={
                                      isDeleting ||
                                      isResetting ||
                                      !neo4jFormData.password ||
                                      expandedSyncState?.status === "syncing"
                                    }
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors disabled:opacity-50"
                                  >
                                    <RefreshCw
                                      className={`w-3.5 h-3.5 ${expandedSyncState?.status === "syncing" ? "animate-spin" : ""}`}
                                    />
                                    {expandedSyncState?.status === "syncing"
                                      ? "Syncing..."
                                      : "Resync"}
                                  </button>
                                )}
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

          {/* Data Management Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Database className="w-4 h-4" />
              Data Management
            </h3>

            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Connections:
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {storageStats.connections}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Conversations:
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {storageStats.totalConversations}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Tools:
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {storageStats.totalTools}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Resources:
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {storageStats.totalResources}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Tool Executions:
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {storageStats.totalToolExecutions}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleClearStorage}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Clear All Data
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                This will clear all MCPConnect data including connections,
                conversations, and settings.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isLoadingSettings || isSaving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <div className="flex items-center gap-2">
                <Loader className="w-4 h-4 animate-spin" />
                Saving...
              </div>
            ) : (
              "Save Settings"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
