// apps/ui/src/components/ConnectionModal.tsx - Fixed TypeScript errors
import React, { useState, useEffect } from "react";
import {
  X,
  Globe,
  Lock,
  Loader,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  TestTube,
  Trash2,
  Plus,
} from "lucide-react";
import { Connection } from "@mcpconnect/schemas";
import { ConnectionService } from "../services/connectionService";

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (connection: Connection) => void;
  onDelete?: (connectionId: string) => void;
  connection?: Connection | null; // If provided, we're editing
  existingConnections: Connection[];
}

// Define form data type to match Connection schema exactly
type FormData = {
  name: string;
  url: string;
  authType: "none" | "bearer" | "apiKey" | "basic";
  credentials: {
    token?: string;
    apiKey?: string;
    username?: string;
    password?: string;
  };
  headers: Record<string, string>;
  timeout: number;
  retryAttempts: number;
};

const initialConnectionState: FormData = {
  name: "",
  url: "",
  authType: "none",
  credentials: {},
  headers: {},
  timeout: 30000,
  retryAttempts: 3,
};

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  connection,
  existingConnections,
}) => {
  const [formData, setFormData] = useState<FormData>(initialConnectionState);
  const [isLoading, setIsLoading] = useState(false);
  const [testStatus, setTestStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [testError, setTestError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [customHeaders, setCustomHeaders] = useState<
    Array<{ key: string; value: string }>
  >([]);

  const isEditing = Boolean(connection);

  // Initialize form data when modal opens or connection changes
  useEffect(() => {
    if (isOpen) {
      if (connection) {
        // Editing existing connection - ensure proper typing
        setFormData({
          name: connection.name,
          url: connection.url,
          authType: connection.authType || "none",
          credentials: connection.credentials || {},
          headers: connection.headers || {},
          timeout: connection.timeout || 30000,
          retryAttempts: connection.retryAttempts || 3,
        });

        // Convert headers to array format
        if (connection.headers) {
          setCustomHeaders(
            Object.entries(connection.headers).map(([key, value]) => ({
              key,
              value,
            }))
          );
        } else {
          setCustomHeaders([]);
        }
      } else {
        // Creating new connection
        setFormData(initialConnectionState);
        setCustomHeaders([]);
      }
      setTestStatus("idle");
      setTestError(null);
      setShowPassword(false);
      setShowToken(false);
    }
  }, [isOpen, connection]);

  const handleInputChange = <K extends keyof FormData>(
    field: K,
    value: FormData[K]
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCredentialChange = (
    field: keyof FormData["credentials"],
    value: string
  ) => {
    setFormData(prev => ({
      ...prev,
      credentials: {
        ...prev.credentials,
        [field]: value,
      },
    }));
  };

  const handleHeaderChange = (
    index: number,
    field: "key" | "value",
    value: string
  ) => {
    const updated = [...customHeaders];
    updated[index] = { ...updated[index], [field]: value };
    setCustomHeaders(updated);

    // Update formData headers
    const headersObj: Record<string, string> = {};
    updated.forEach(({ key, value }) => {
      if (key.trim() && value.trim()) {
        headersObj[key.trim()] = value.trim();
      }
    });
    handleInputChange("headers", headersObj);
  };

  const addCustomHeader = () => {
    setCustomHeaders(prev => [...prev, { key: "", value: "" }]);
  };

  const removeCustomHeader = (index: number) => {
    const updated = customHeaders.filter((_, i) => i !== index);
    setCustomHeaders(updated);

    // Update formData headers
    const headersObj: Record<string, string> = {};
    updated.forEach(({ key, value }) => {
      if (key.trim() && value.trim()) {
        headersObj[key.trim()] = value.trim();
      }
    });
    handleInputChange("headers", headersObj);
  };

  const testConnection = async () => {
    if (!formData.name.trim() || !formData.url.trim()) {
      setTestError("Name and URL are required");
      return;
    }

    if (!ConnectionService.validateConnectionUrl(formData.url)) {
      setTestError(
        "Please enter a valid URL (http://, https://, ws://, or wss://)"
      );
      return;
    }

    setTestStatus("testing");
    setTestError(null);

    try {
      const testConnection: Connection = {
        id: connection?.id || "test",
        name: formData.name,
        url: formData.url,
        isActive: true,
        isConnected: false,
        authType: formData.authType,
        credentials: formData.credentials,
        headers: formData.headers,
        timeout: formData.timeout,
        retryAttempts: formData.retryAttempts,
      };

      const isConnected =
        await ConnectionService.testConnection(testConnection);

      if (isConnected) {
        setTestStatus("success");
      } else {
        setTestStatus("error");
        setTestError(
          "Connection test failed. Please check your URL and credentials."
        );
      }
    } catch (error) {
      setTestStatus("error");
      setTestError(
        error instanceof Error ? error.message : "Connection test failed"
      );
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.url.trim()) {
      setTestError("Name and URL are required");
      return;
    }

    if (!ConnectionService.validateConnectionUrl(formData.url)) {
      setTestError("Please enter a valid URL");
      return;
    }

    // Check for duplicate names (excluding current connection if editing)
    const isDuplicate = existingConnections.some(
      conn =>
        conn.name.toLowerCase() === formData.name.toLowerCase() &&
        conn.id !== connection?.id
    );

    if (isDuplicate) {
      setTestError("A connection with this name already exists");
      return;
    }

    setIsLoading(true);

    try {
      const connectionData: Connection = {
        id: connection?.id || "", // Will be generated in service if empty
        name: formData.name.trim(),
        url: formData.url.trim(),
        isActive: false,
        isConnected: false,
        authType: formData.authType,
        credentials: formData.credentials,
        headers: formData.headers,
        timeout: formData.timeout,
        retryAttempts: formData.retryAttempts,
      };

      // If creating new, generate ID
      const finalConnection = connection?.id
        ? connectionData
        : ConnectionService.createConnection(connectionData);

      onSave(finalConnection);
      onClose();
    } catch (error) {
      setTestError(
        error instanceof Error ? error.message : "Failed to save connection"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    if (!connection?.id || !onDelete) return;

    const confirmed = confirm(
      `Are you sure you want to delete "${connection.name}"? This action cannot be undone.`
    );

    if (confirmed) {
      onDelete(connection.id);
      onClose();
    }
  };

  const getTestStatusIcon = () => {
    switch (testStatus) {
      case "testing":
        return <Loader className="w-4 h-4 animate-spin text-blue-500" />;
      case "success":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <TestTube className="w-4 h-4 text-gray-400" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Globe className="w-5 h-5" />
            {isEditing ? "Edit Connection" : "New Connection"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Basic Information
            </h3>

            {/* Connection Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Connection Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={e => handleInputChange("name", e.target.value)}
                placeholder="My MCP Server"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Connection URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Server URL *
              </label>
              <input
                type="url"
                value={formData.url}
                onChange={e => handleInputChange("url", e.target.value)}
                placeholder="wss://api.example.com/mcp or http://localhost:8080"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Supports WebSocket (ws://, wss://) and HTTP (http://, https://)
                protocols
              </p>
            </div>
          </div>

          {/* Authentication */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Authentication
            </h3>

            {/* Auth Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Authentication Type
              </label>
              <select
                value={formData.authType}
                onChange={e =>
                  handleInputChange(
                    "authType",
                    e.target.value as FormData["authType"]
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="none">No Authentication</option>
                <option value="bearer">Bearer Token</option>
                <option value="apiKey">API Key</option>
                <option value="basic">Basic Auth</option>
              </select>
            </div>

            {/* Bearer Token */}
            {formData.authType === "bearer" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Bearer Token
                </label>
                <div className="relative">
                  <input
                    type={showToken ? "text" : "password"}
                    value={formData.credentials.token || ""}
                    onChange={e =>
                      handleCredentialChange("token", e.target.value)
                    }
                    placeholder="your-bearer-token"
                    className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showToken ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* API Key */}
            {formData.authType === "apiKey" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  API Key
                </label>
                <div className="relative">
                  <input
                    type={showToken ? "text" : "password"}
                    value={formData.credentials.apiKey || ""}
                    onChange={e =>
                      handleCredentialChange("apiKey", e.target.value)
                    }
                    placeholder="your-api-key"
                    className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showToken ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Basic Auth */}
            {formData.authType === "basic" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={formData.credentials.username || ""}
                    onChange={e =>
                      handleCredentialChange("username", e.target.value)
                    }
                    placeholder="username"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={formData.credentials.password || ""}
                      onChange={e =>
                        handleCredentialChange("password", e.target.value)
                      }
                      placeholder="password"
                      className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            )}
          </div>

          {/* Custom Headers */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Custom Headers
              </h3>
              <button
                onClick={addCustomHeader}
                className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700"
              >
                <Plus className="w-4 h-4" />
                Add Header
              </button>
            </div>

            {customHeaders.map((header, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5">
                  <input
                    type="text"
                    value={header.key}
                    onChange={e =>
                      handleHeaderChange(index, "key", e.target.value)
                    }
                    placeholder="Header name"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-6">
                  <input
                    type="text"
                    value={header.value}
                    onChange={e =>
                      handleHeaderChange(index, "value", e.target.value)
                    }
                    placeholder="Header value"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-1">
                  <button
                    onClick={() => removeCustomHeader(index)}
                    className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Advanced Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Advanced Settings
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Timeout (ms)
                </label>
                <input
                  type="number"
                  min="1000"
                  max="300000"
                  step="1000"
                  value={formData.timeout}
                  onChange={e =>
                    handleInputChange(
                      "timeout",
                      parseInt(e.target.value) || 30000
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Retry Attempts
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={formData.retryAttempts}
                  onChange={e =>
                    handleInputChange(
                      "retryAttempts",
                      parseInt(e.target.value) || 3
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Test Connection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Test Connection
              </h3>
              <button
                onClick={testConnection}
                disabled={testStatus === "testing"}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {getTestStatusIcon()}
                Test Connection
              </button>
            </div>

            {testStatus === "success" && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                <p className="text-sm text-green-800 dark:text-green-200">
                  Connection test successful! The server is reachable.
                </p>
              </div>
            )}

            {testStatus === "error" && testError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <p className="text-sm text-red-800 dark:text-red-200">
                  {testError}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <div>
            {isEditing && onDelete && (
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete Connection
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={
                isLoading || !formData.name.trim() || !formData.url.trim()
              }
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading && <Loader className="w-4 h-4 animate-spin" />}
              {isEditing ? "Update Connection" : "Create Connection"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
