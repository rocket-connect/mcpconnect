/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
import React from "react";
import { CheckCircle, AlertCircle, Clock } from "lucide-react";
import { ToolExecution } from "@mcpconnect/schemas";
import { formatTimestamp } from "../common/JsonCodeBlock";

export interface ExecutionRowProps {
  execution: ToolExecution;
  index: number;
  totalExecutions: number;
  isSelected: boolean;
  showDemoData: boolean;
  onExecutionClick: (executionId: string) => void;
}

export const ExecutionRow: React.FC<ExecutionRowProps> = ({
  execution,
  index,
  totalExecutions,
  isSelected,
  showDemoData,
  onExecutionClick,
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

  const formatDuration = (duration?: number) => {
    if (!duration) return "—";
    return duration < 1000
      ? `${duration}ms`
      : `${(duration / 1000).toFixed(2)}s`;
  };

  return (
    <div
      className={`px-3 py-2.5 cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 ${
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
        <div className="col-span-6 flex items-center gap-1.5 min-w-0">
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
          {formatDuration(execution.duration)}
        </div>
      </div>
    </div>
  );
};
