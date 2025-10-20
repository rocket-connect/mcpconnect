/* eslint-disable jsx-a11y/label-has-associated-control */
// packages/components/src/connections/ConnectionCorsConfig.tsx
import React from "react";
import { Info, AlertCircle } from "lucide-react";
import { CorsConfig } from "@mcpconnect/schemas";

export interface ConnectionCorsConfigProps {
  corsConfig: CorsConfig;
  onCorsConfigChange: (config: CorsConfig) => void;
  disabled?: boolean;
}

export const ConnectionCorsConfig: React.FC<ConnectionCorsConfigProps> = ({
  corsConfig,
  onCorsConfigChange,
  disabled = false,
}) => {
  const handleToggleCors = () => {
    onCorsConfigChange({
      ...corsConfig,
      enabled: !corsConfig.enabled,
    });
  };

  const handleFieldChange = (field: keyof CorsConfig, value: any) => {
    onCorsConfigChange({
      ...corsConfig,
      [field]: value,
    });
  };

  return (
    <div className="space-y-4">
      {/* CORS Enable Toggle */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
              CORS Configuration
            </h4>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={corsConfig.enabled}
                onChange={handleToggleCors}
                disabled={disabled}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
            Enable Cross-Origin Resource Sharing (CORS) to allow requests from
            different origins. Required for browser-based MCP connections.
          </p>
        </div>
      </div>

      {/* CORS Settings - Only show when enabled */}
      {corsConfig.enabled && (
        <div className="space-y-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50">
          {/* Origin */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Allowed Origin
              <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                (optional)
              </span>
            </label>
            <input
              type="text"
              value={corsConfig.origin || ""}
              onChange={e =>
                handleFieldChange("origin", e.target.value || undefined)
              }
              disabled={disabled}
              placeholder="* (allow all origins)"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Specify the origin (e.g., https://example.com) or leave empty for
              * (all origins)
            </p>
          </div>

          {/* Credentials */}
          <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Include Credentials
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Allow cookies and authentication headers
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={corsConfig.credentials || false}
                onChange={e =>
                  handleFieldChange("credentials", e.target.checked)
                }
                disabled={disabled}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Methods */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Allowed Methods
              <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                (optional)
              </span>
            </label>
            <input
              type="text"
              value={corsConfig.methods || ""}
              onChange={e =>
                handleFieldChange("methods", e.target.value || undefined)
              }
              disabled={disabled}
              placeholder="GET,POST,PUT,DELETE,OPTIONS"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Comma-separated list of HTTP methods
            </p>
          </div>

          {/* Allowed Headers */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Allowed Headers
              <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                (optional)
              </span>
            </label>
            <input
              type="text"
              value={corsConfig.allowedHeaders || ""}
              onChange={e =>
                handleFieldChange("allowedHeaders", e.target.value || undefined)
              }
              disabled={disabled}
              placeholder="Content-Type,Authorization,X-API-Key"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Comma-separated list of allowed request headers
            </p>
          </div>

          {/* Warning for credentials + wildcard origin */}
          {corsConfig.credentials &&
            (!corsConfig.origin || corsConfig.origin === "*") && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    <strong>Warning:</strong> When credentials are enabled, you
                    must specify a specific origin. Wildcard (*) origins are not
                    allowed with credentials.
                  </p>
                </div>
              </div>
            )}
        </div>
      )}
    </div>
  );
};
