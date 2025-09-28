// packages/components/src/common/ToolCard.tsx
import React from "react";
import { Tool } from "@mcpconnect/schemas";
import {
  Globe,
  FileText,
  Database,
  Zap,
  Mail,
  Code,
  Settings,
  Wrench,
  Cpu,
  ExternalLink,
  Power,
  PowerOff,
} from "lucide-react";
import { TruncatedText } from "./TruncatedText";

export interface ToolCardProps {
  tool: Tool;
  enabled: boolean;
  onToggle?: () => void;
  onNavigate?: (toolId: string) => void;
  connectionId?: string;
  isDemoMode?: boolean;
}

export const ToolCard: React.FC<ToolCardProps> = ({
  tool,
  enabled,
  onToggle,
  onNavigate,
  connectionId,
  isDemoMode = false,
}) => {
  // Check if this is a system tool
  const isSystemTool =
    tool.category === "system" || tool.tags?.includes("system");

  const getCategoryIcon = (category?: string) => {
    // System tools get special icon
    if (isSystemTool) {
      return <Wrench className="w-3.5 h-3.5" />;
    }

    switch (category?.toLowerCase()) {
      case "web":
        return <Globe className="w-3.5 h-3.5" />;
      case "files":
        return <FileText className="w-3.5 h-3.5" />;
      case "database":
        return <Database className="w-3.5 h-3.5" />;
      case "apis":
        return <Zap className="w-3.5 h-3.5" />;
      case "communication":
        return <Mail className="w-3.5 h-3.5" />;
      case "development":
        return <Code className="w-3.5 h-3.5" />;
      default:
        return <Settings className="w-3.5 h-3.5" />;
    }
  };

  const getCategoryColor = (category?: string) => {
    // System tools get special purple/indigo styling
    if (isSystemTool) {
      return "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400";
    }

    switch (category?.toLowerCase()) {
      case "web":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400";
      case "files":
        return "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400";
      case "database":
        return "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400";
      case "apis":
        return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400";
      case "communication":
        return "bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400";
      case "development":
        return "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400";
      default:
        return "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400";
    }
  };

  const handleNavigateClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDemoMode && onNavigate && connectionId) {
      onNavigate(tool.id || tool.name);
    }
  };

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDemoMode && onToggle) {
      onToggle();
    }
  };

  return (
    <div
      className={`p-3 border rounded-lg transition-all duration-200 ${
        enabled
          ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
          : "bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 opacity-60"
      } ${isDemoMode ? "cursor-default opacity-60" : ""} ${
        isSystemTool ? "ring-1 ring-indigo-200 dark:ring-indigo-800" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Tool Icon */}
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
            enabled
              ? getCategoryColor(tool.category)
              : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
          }`}
        >
          {getCategoryIcon(tool.category)}
        </div>

        {/* Tool Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3
                  className={`font-medium text-sm ${
                    enabled
                      ? "text-gray-900 dark:text-white"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  <TruncatedText text={tool.name} maxLength={20} />
                </h3>
                {/* System tool indicator */}
                {isSystemTool && (
                  <div className="flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-indigo-500" />
                    <span className="text-xs px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded text-[10px] font-medium">
                      SYS
                    </span>
                  </div>
                )}
              </div>

              <p
                className={`text-xs ${
                  enabled
                    ? "text-gray-500 dark:text-gray-400"
                    : "text-gray-400 dark:text-gray-500"
                }`}
              >
                <TruncatedText
                  text={tool.description || "No description"}
                  maxLength={60}
                />
              </p>

              {/* Category badge */}
              {tool.category && !isSystemTool && (
                <div className="mt-2">
                  <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                    {tool.category}
                  </span>
                </div>
              )}

              {/* System tool additional info */}
              {isSystemTool && (
                <div className="text-xs mt-1 text-indigo-600 dark:text-indigo-400 font-medium">
                  Built-in • Always available
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mt-3">
            {/* Enable/Disable Button */}
            <button
              onClick={handleToggleClick}
              disabled={isDemoMode}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                enabled
                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800/50"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              } disabled:cursor-not-allowed disabled:opacity-50`}
              title={enabled ? "Disable tool" : "Enable tool"}
            >
              {enabled ? (
                <>
                  <Power className="w-3 h-3" />
                  Enabled
                </>
              ) : (
                <>
                  <PowerOff className="w-3 h-3" />
                  Disabled
                </>
              )}
            </button>

            {/* Navigate Button */}
            {!isDemoMode && onNavigate && connectionId && (
              <button
                onClick={handleNavigateClick}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                title="Open tool detail page"
              >
                <ExternalLink className="w-3 h-3" />
                Open
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
