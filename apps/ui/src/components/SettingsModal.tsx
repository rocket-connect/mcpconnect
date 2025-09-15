/* eslint-disable react-hooks/exhaustive-deps */
// apps/ui/src/components/SettingsModal.tsx - Refactored to use AISDKAdapter
import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Brain,
  Trash2,
  Database,
  AlertCircle,
  CheckCircle,
  Loader,
} from "lucide-react";
import {
  ModelService,
  LLMSettings,
  ModelOption,
} from "../services/modelService";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const defaultSettings: LLMSettings = {
  provider: "anthropic",
  apiKey: "",
  model: "claude-3-5-sonnet-20241022",
  baseUrl: "",
  temperature: 0.7,
  maxTokens: 4096,
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [settings, setSettings] = useState<LLMSettings>(defaultSettings);
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<
    "idle" | "testing" | "valid" | "invalid"
  >("idle");
  const [storageStats, setStorageStats] = useState({
    itemCount: 0,
    totalSize: 0,
  });

  // Load settings from localStorage on mount
  useEffect(() => {
    if (isOpen) {
      const savedSettings = ModelService.loadSettings();
      if (savedSettings) {
        setSettings({ ...defaultSettings, ...savedSettings });
      } else {
        // Set default settings for Claude
        const providerDefaults = ModelService.getDefaultSettings("anthropic");
        setSettings(prev => ({ ...prev, ...providerDefaults }));
      }

      calculateStorageStats();
    }
  }, [isOpen]);

  const loadAvailableModels = useCallback(async () => {
    setIsLoadingModels(true);
    try {
      // Load static models immediately (AISDKAdapter handles this)
      const staticModels = ModelService.getAvailableModels("anthropic");
      setAvailableModels(staticModels);

      // For Anthropic, we use static models as they don't provide a dynamic models API
      // The adapter handles this internally
      if (settings.apiKey) {
        try {
          const dynamicModels = await ModelService.fetchModelsFromAPI(
            "anthropic",
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

  const calculateStorageStats = () => {
    let itemCount = 0;
    let totalSize = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("mcpconnect")) {
        itemCount++;
        const value = localStorage.getItem(key) || "";
        totalSize += key.length + value.length;
      }
    }

    setStorageStats({ itemCount, totalSize });
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

      // Load provider defaults when switching providers (for future expansion)
      if (key === "provider") {
        const providerDefaults = ModelService.getDefaultSettings(
          value as "anthropic"
        );
        return { ...newSettings, ...providerDefaults };
      }

      return newSettings;
    });
  };

  const handleSave = () => {
    ModelService.saveSettings(settings);
    onClose();
  };

  const handleClearStorage = () => {
    if (
      confirm(
        "Are you sure you want to clear all MCPConnect data? This cannot be undone."
      )
    ) {
      // Clear all MCPConnect-related localStorage items
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("mcpconnect")) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key));
      calculateStorageStats();

      // Show confirmation
      alert("Local storage cleared successfully. The page will reload.");
      window.location.reload();
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
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
          {/* Claude Configuration Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Brain className="w-4 h-4" />
              Claude Configuration
            </h3>

            <div className="space-y-4">
              {/* Provider Selection - Hidden but kept for expandability */}
              <input type="hidden" value={settings.provider} />

              {/* Model Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Claude Model
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Anthropic API Key
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={settings.apiKey}
                    onChange={e =>
                      handleSettingChange("apiKey", e.target.value)
                    }
                    placeholder={ModelService.getApiKeyPlaceholder("anthropic")}
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
                    Invalid API key format for Anthropic
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

              {/* Temperature */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Temperature ({settings.temperature})
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.temperature}
                  onChange={e =>
                    handleSettingChange(
                      "temperature",
                      parseFloat(e.target.value)
                    )
                  }
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <span>Focused (0)</span>
                  <span>Balanced (0.5)</span>
                  <span>Creative (1)</span>
                </div>
              </div>

              {/* Max Tokens */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Max Tokens
                  {settings.model && (
                    <span className="ml-2 text-xs text-gray-500">
                      (Context:{" "}
                      {ModelService.getContextLimit(
                        settings.provider,
                        settings.model
                      ).toLocaleString()}
                      )
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  min="100"
                  max={ModelService.getContextLimit(
                    settings.provider,
                    settings.model
                  )}
                  step="100"
                  value={settings.maxTokens}
                  onChange={e =>
                    handleSettingChange("maxTokens", parseInt(e.target.value))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Pricing Information */}
              {(() => {
                const pricing = ModelService.getModelPricing(
                  settings.provider,
                  settings.model
                );
                if (pricing) {
                  return (
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Pricing:</span> $
                        {pricing.input}/1M input tokens, ${pricing.output}/1M
                        output tokens
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>

          {/* Data Management Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Database className="w-4 h-4" />
              Data Management
            </h3>

            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Storage Usage
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatBytes(storageStats.totalSize)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Items Stored
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {storageStats.itemCount}
                </span>
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
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};
