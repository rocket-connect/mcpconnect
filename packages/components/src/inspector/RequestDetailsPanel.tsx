import React from "react";
import { Database, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { ToolExecution } from "@mcpconnect/schemas";
import { formatTimestamp } from "../common/JsonCodeBlock";

export interface RequestDetailsPanelProps {
  selected: ToolExecution | undefined;
  showDemoData: boolean;
  emptyStateTitle: string;
  emptyStateSubtitle: string;
}

// Helper to format duration
const formatDuration = (execution?: ToolExecution): string => {
  if (!execution) return "—";

  // First try direct duration field
  if (execution.duration !== undefined) {
    return execution.duration < 1000
      ? `${execution.duration}ms`
      : `${(execution.duration / 1000).toFixed(2)}s`;
  }

  // Try to calculate from timestamps
  if (execution.request?.timestamp && execution.response?.timestamp) {
    try {
      const startTime = new Date(execution.request.timestamp).getTime();
      const endTime = new Date(execution.response.timestamp).getTime();
      const duration = endTime - startTime;

      return duration < 1000
        ? `${duration}ms`
        : `${(duration / 1000).toFixed(2)}s`;
    } catch {
      return "—";
    }
  }

  return "—";
};

export const RequestDetailsPanel: React.FC<RequestDetailsPanelProps> = ({
  selected,
  showDemoData,
  emptyStateTitle,
  emptyStateSubtitle,
}) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-3.5 h-3.5 text-green-500" />;
      case "error":
        return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
      case "pending":
        return <Clock className="w-3.5 h-3.5 text-blue-500 animate-pulse" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "text-green-600 dark:text-green-400";
      case "error":
        return "text-red-600 dark:text-red-400";
      case "pending":
        return "text-blue-600 dark:text-blue-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  if (!selected) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400 p-4">
        <div className="text-center">
          <Database className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium mb-2 text-sm text-gray-900 dark:text-gray-100">
            {emptyStateTitle}
          </p>
          <p className="text-xs">{emptyStateSubtitle}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Details Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex-shrink-0 bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(selected.status)}
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
              {selected.tool || "Unknown Tool"}
            </h4>
            <span
              className={`text-xs font-medium px-2 py-1 rounded-full ${
                selected.status === "pending"
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  : selected.status === "success"
                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                    : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
              }`}
            >
              {selected.status === "pending"
                ? "Pending"
                : selected.status === "success"
                  ? "200 OK"
                  : "500 Error"}
            </span>
            {showDemoData && (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                Demo
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {formatTimestamp(selected.timestamp || selected.request?.timestamp)}{" "}
            • {formatDuration(selected)}
          </div>
        </div>
      </div>

      {/* Metadata Section - Compact */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Tool:</span>
              <span className="font-mono text-gray-900 dark:text-gray-100">
                {selected.tool || "Unknown"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">
                Duration:
              </span>
              <span className="text-gray-900 dark:text-gray-100">
                {formatDuration(selected)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Status:</span>
              <span
                className={`font-medium ${getStatusColor(selected.status)}`}
              >
                {selected.status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Time:</span>
              <span className="text-gray-900 dark:text-gray-100">
                {formatTimestamp(
                  selected.timestamp || selected.request?.timestamp
                )}
              </span>
            </div>

            {/* Show start time if available */}
            {selected.request?.timestamp && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">
                  Started:
                </span>
                <span className="text-gray-900 dark:text-gray-100">
                  {formatTimestamp(selected.request.timestamp)}
                </span>
              </div>
            )}

            {/* Show end time if available */}
            {selected.response?.timestamp && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">
                  Completed:
                </span>
                <span className="text-gray-900 dark:text-gray-100">
                  {formatTimestamp(selected.response.timestamp)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
