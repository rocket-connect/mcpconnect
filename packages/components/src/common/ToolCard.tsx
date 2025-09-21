/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
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
  CheckCircle,
  XCircle,
} from "lucide-react";
import { TruncatedText } from "./TruncatedText";

export interface ToolCardProps {
  tool: Tool;
  enabled: boolean;
  onClick?: () => void;
  isDemoMode?: boolean;
}

export const ToolCard: React.FC<ToolCardProps> = ({
  tool,
  enabled,
  onClick,
  isDemoMode = false,
}) => {
  const getCategoryIcon = (category?: string) => {
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

  return (
    <div
      className={`p-2.5 border rounded-lg cursor-pointer transition-all duration-200 ${
        enabled
          ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
          : "bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 opacity-60"
      } ${isDemoMode ? "cursor-default opacity-60" : ""}`}
      onClick={() => !isDemoMode && onClick?.()}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
            enabled
              ? getCategoryColor(tool.category)
              : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
          }`}
        >
          {getCategoryIcon(tool.category)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div
              className={`font-medium text-xs ${
                enabled
                  ? "text-gray-900 dark:text-white"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              <TruncatedText text={tool.name} maxLength={20} />
            </div>
            <div className="flex items-center gap-1">
              {tool.category && (
                <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                  {tool.category}
                </span>
              )}
              {enabled ? (
                <CheckCircle className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
              )}
            </div>
          </div>
          <div
            className={`text-xs mt-0.5 ${
              enabled
                ? "text-gray-500 dark:text-gray-400"
                : "text-gray-400 dark:text-gray-500"
            }`}
          >
            <TruncatedText
              text={tool.description || "No description"}
              maxLength={45}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
