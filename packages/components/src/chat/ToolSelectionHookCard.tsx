import React, { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Workflow,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Zap,
} from "lucide-react";

export type HookType =
  | "pre_tool"
  | "post_tool"
  | "pre_selection"
  | "post_selection";
export type HookStatus =
  | "pending"
  | "running"
  | "completed"
  | "error"
  | "skipped";

export interface ToolHookEvent {
  hookType: HookType;
  hookName: string;
  status: HookStatus;
  durationMs?: number;
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface ToolSelectionHookCardProps {
  /** Type of hook being displayed */
  hookType: HookType;
  /** Name of the hook */
  hookName: string;
  /** Current status */
  status: HookStatus;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Associated tool name (for pre/post tool hooks) */
  toolName?: string;
  /** Additional metadata to display */
  metadata?: Record<string, unknown>;
  /** Error message if status is error */
  error?: string;
  /** Timestamp */
  timestamp?: Date;
}

export const ToolSelectionHookCard: React.FC<ToolSelectionHookCardProps> = ({
  hookType,
  hookName,
  status,
  durationMs,
  toolName,
  metadata,
  error,
  timestamp,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = () => {
    console.log("[ToolSelectionHookCard] Toggle expanded:", !isExpanded);
    setIsExpanded(!isExpanded);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const getHookTypeLabel = (type: HookType): string => {
    switch (type) {
      case "pre_tool":
        return "Pre-Tool Hook";
      case "post_tool":
        return "Post-Tool Hook";
      case "pre_selection":
        return "Pre-Selection Hook";
      case "post_selection":
        return "Post-Selection Hook";
      default:
        return "Hook";
    }
  };

  const getHookTypeDescription = (type: HookType): string => {
    switch (type) {
      case "pre_tool":
        return "Runs before tool execution";
      case "post_tool":
        return "Runs after tool execution";
      case "pre_selection":
        return "Runs before tool selection";
      case "post_selection":
        return "Runs after tools are selected";
      default:
        return "";
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case "running":
        return <Zap className="w-4 h-4 text-blue-500 animate-pulse" />;
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "skipped":
        return <ArrowRight className="w-4 h-4 text-gray-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case "running":
        return "Running";
      case "completed":
        return "Completed";
      case "error":
        return "Failed";
      case "skipped":
        return "Skipped";
      default:
        return "Pending";
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "running":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300";
      case "completed":
        return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300";
      case "error":
        return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300";
      case "skipped":
        return "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400";
      default:
        return "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400";
    }
  };

  const getBorderColor = () => {
    switch (status) {
      case "running":
        return "border-blue-200 dark:border-blue-800";
      case "completed":
        return "border-green-200 dark:border-green-800";
      case "error":
        return "border-red-200 dark:border-red-800";
      default:
        return "border-gray-200 dark:border-gray-700";
    }
  };

  const getBgColor = () => {
    switch (status) {
      case "running":
        return "bg-blue-50 dark:bg-blue-900/10";
      case "completed":
        return "bg-green-50 dark:bg-green-900/10";
      case "error":
        return "bg-red-50 dark:bg-red-900/10";
      default:
        return "bg-gray-50 dark:bg-gray-900/10";
    }
  };

  const hasExpandableContent = metadata || error;

  return (
    <div
      className={`rounded-lg border overflow-hidden ${getBorderColor()} ${getBgColor()}`}
    >
      {/* Header */}
      <button
        onClick={handleToggle}
        disabled={!hasExpandableContent}
        className={`w-full flex items-center justify-between p-3 transition-colors ${
          hasExpandableContent
            ? "hover:bg-gray-100/50 dark:hover:bg-gray-800/50 cursor-pointer"
            : "cursor-default"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white dark:bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0 border border-gray-200 dark:border-gray-700">
            <Workflow className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {hookName}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor()}`}
              >
                {getStatusLabel()}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>{getHookTypeLabel(hookType)}</span>
              {toolName && (
                <>
                  <span>•</span>
                  <span className="font-medium">{toolName}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {getStatusIcon()}
          {durationMs !== undefined && status === "completed" && (
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <Clock className="w-3 h-3" />
              {durationMs}ms
            </div>
          )}
          {timestamp && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {formatTime(timestamp)}
            </span>
          )}
          {hasExpandableContent &&
            (isExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ))}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && hasExpandableContent && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          {/* Description */}
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {getHookTypeDescription(hookType)}
          </p>

          {/* Error */}
          {error && (
            <div className="mb-3 p-3 bg-red-100 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-medium text-red-800 dark:text-red-200 block mb-1">
                    Hook Error
                  </span>
                  <span className="text-xs text-red-700 dark:text-red-300">
                    {error}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Metadata */}
          {metadata && Object.keys(metadata).length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                Hook Data
              </h4>
              <div className="bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 p-3">
                <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto">
                  {JSON.stringify(metadata, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
