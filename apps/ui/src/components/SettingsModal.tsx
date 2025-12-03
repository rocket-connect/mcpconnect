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
} from "lucide-react";
import {
  ModelService,
  LLMSettings,
  ModelOption,
  ModelProvider,
} from "../services/modelService";
import { useStorage } from "../contexts/StorageContext";
import {
  Neo4jConfigSection,
  type Neo4jConnectionConfig,
} from "@mcpconnect/components";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
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

  // Neo4j configuration state
  const [neo4jConfig, setNeo4jConfig] = useState<Neo4jConnectionConfig>({
    uri: "neo4j://localhost:7687",
    username: "neo4j",
    password: "",
    database: "neo4j",
  });
  const [isNeo4jSyncing, setIsNeo4jSyncing] = useState(false);
  const [isVectorized, setIsVectorized] = useState(false);

  // Load settings from adapter on mount
  useEffect(() => {
    if (isOpen && adapter) {
      loadSettings();
      calculateStorageStats();
    }
  }, [isOpen, adapter]);

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

  // Neo4j connection handlers
  const handleNeo4jTestConnection = async (): Promise<boolean> => {
    console.log("[SettingsModal] Testing Neo4j connection:", {
      uri: neo4jConfig.uri,
      username: neo4jConfig.username,
      database: neo4jConfig.database,
    });

    // Simulate async operation - in real implementation this would call the backend
    await new Promise(resolve => setTimeout(resolve, 1500));

    // For now, always succeed (mocked)
    console.log("[SettingsModal] Neo4j connection test successful (mocked)");
    return true;
  };

  const handleNeo4jSync = async (): Promise<void> => {
    setIsNeo4jSyncing(true);
    console.log("[SettingsModal] Starting Neo4j sync:", {
      config: { ...neo4jConfig, password: "***" },
      toolCount: storageStats.totalTools,
    });

    // Simulate sync operation
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log("[SettingsModal] Neo4j sync complete (mocked)");
    setIsVectorized(true);
    setIsNeo4jSyncing(false);
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

          {/* Vector Search Section */}
          {!isLoadingSettings && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-500" />
                Vector Search
                {isVectorized && (
                  <span className="ml-2 inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                    <CheckCircle className="w-3 h-3" />
                    Enabled
                  </span>
                )}
              </h3>

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Enable intelligent tool selection with semantic search. Connect
                to Neo4j to index your tools with vector embeddings.
              </p>

              <Neo4jConfigSection
                config={neo4jConfig}
                onConfigChange={setNeo4jConfig}
                onTestConnection={handleNeo4jTestConnection}
                onSync={handleNeo4jSync}
                toolCount={storageStats.totalTools}
                isSyncing={isNeo4jSyncing}
                isOpenAIConfigured={settings.provider === "openai"}
              />
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
