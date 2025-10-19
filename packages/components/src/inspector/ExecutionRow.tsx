/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import React from "react";
import { CheckCircle, AlertCircle, Clock, Trash2 } from "lucide-react";
import { ToolExecution } from "@mcpconnect/schemas";
import { formatTimestamp } from "../common/JsonCodeBlock";

export interface ExecutionRowProps {
  execution: ToolExecution;
  index: number;
  totalExecutions: number;
  isSelected: boolean;
  showDemoData: boolean;
  onExecutionClick: (executionId: string) => void;
  onDeleteExecution?: (executionId: string, e: React.MouseEvent) => void;
}

// Helper to format duration with fallback
const formatExecutionDuration = (execution: ToolExecution): string => {
  // First try direct duration field
  if (execution.duration !== undefined) {
    return execution.duration < 1000
      ? `${execution.duration}ms`
      : `${(execution.duration / 1000).toFixed(2)}s`;
  }

  // Try to calculate from request/response timestamps
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

export const ExecutionRow: React.FC<ExecutionRowProps> = ({
  execution,
  index,
  totalExecutions,
  isSelected,
  showDemoData,
  onExecutionClick,
  onDeleteExecution,
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

  const getStatusCode = (status: string) => {
    switch (status) {
      case "success":
        return "200";
      case "error":
        return "500";
      case "pending":
        return "...";
      default:
        return "—";
    }
  };

  return (
    <div
      className={`group px-3 py-2.5 cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 ${
        isSelected
          ? "bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500"
          : ""
      }${
        index < totalExecutions - 1
          ? " border-b border-gray-100 dark:border-gray-800"
          : ""
      } ${showDemoData ? "opacity-75" : ""}`}
      onClick={() => !showDemoData && onExecutionClick(execution.id)}
    >
      <div className="grid grid-cols-12 gap-2 items-center text-xs">
        <div className="col-span-5 flex items-center gap-1.5 min-w-0">
          {getStatusIcon(execution.status)}
          <span className="text-gray-900 dark:text-gray-100 truncate font-mono text-xs">
            {execution.tool || "Unknown Tool"}
          </span>
        </div>

        <div
          className={`col-span-2 text-center font-medium text-xs ${getStatusColor(execution.status)}`}
        >
          {getStatusCode(execution.status)}
        </div>

        <div className="col-span-2 text-center text-gray-500 dark:text-gray-400 text-xs">
          {formatTimestamp(execution.timestamp || execution.request?.timestamp)}
        </div>

        <div className="col-span-2 text-center text-gray-600 dark:text-gray-400 font-mono text-xs">
          {formatExecutionDuration(execution)}
        </div>

        <div className="col-span-1 flex items-center justify-end">
          {!showDemoData && onDeleteExecution && (
            <button
              onClick={e => onDeleteExecution(execution.id, e)}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
              title="Hide this request"
            >
              <Trash2 className="w-3 h-3 text-gray-400 hover:text-red-600 dark:hover:text-red-400" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
