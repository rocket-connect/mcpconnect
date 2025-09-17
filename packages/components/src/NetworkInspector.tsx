/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
import React, { useState, useEffect, useRef } from "react";
import {
  ChevronRight,
  ChevronDown,
  Clock,
  Database,
  AlertCircle,
  CheckCircle,
  Copy,
} from "lucide-react";
import { ToolExecution } from "@mcpconnect/schemas";

export interface NetworkInspectorProps {
  executions?: ToolExecution[];
  connectionId?: string;
  connectionName?: string;
  chatId?: string;
  chatTitle?: string;
  onToolCallClick?: (toolCallId: string) => void;
  selectedExecution?: string | null;
  className?: string;
}

export const NetworkInspector: React.FC<NetworkInspectorProps> = ({
  executions = [],
  connectionName,
  chatTitle,
  onToolCallClick,
  selectedExecution: externalSelectedExecution,
  className = "",
}) => {
  const [internalSelectedExecution, setInternalSelectedExecution] = useState<
    string | null
  >(executions[0]?.id || null);

  const selectedExecution =
    externalSelectedExecution !== undefined
      ? externalSelectedExecution
      : internalSelectedExecution;

  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const prevExecutionsRef = useRef<ToolExecution[]>([]);

  // Auto-select most recent execution when new ones arrive
  useEffect(() => {
    if (executions.length > prevExecutionsRef.current.length) {
      // New execution(s) added
      const newExecutions = executions.slice(prevExecutionsRef.current.length);
      const mostRecentExecution = newExecutions[newExecutions.length - 1];

      if (mostRecentExecution && externalSelectedExecution === undefined) {
        setInternalSelectedExecution(mostRecentExecution.id);
      }
    }

    prevExecutionsRef.current = executions;
  }, [executions, externalSelectedExecution]);

  useEffect(() => {
    if (
      externalSelectedExecution !== undefined &&
      externalSelectedExecution !== null
    ) {
      setInternalSelectedExecution(externalSelectedExecution);
    }
  }, [externalSelectedExecution]);

  useEffect(() => {
    if (selectedExecution) {
      const newExpanded = new Set(expandedItems);
      newExpanded.add(`${selectedExecution}-request`);
      newExpanded.add(`${selectedExecution}-response`);
      setExpandedItems(newExpanded);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExecution]);

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return "—";
    return duration < 1000
      ? `${duration}ms`
      : `${(duration / 1000).toFixed(2)}s`;
  };

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

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
  };

  const handleExecutionClick = (executionId: string) => {
    if (externalSelectedExecution !== undefined) {
      onToolCallClick?.(executionId);
    } else {
      setInternalSelectedExecution(executionId);
    }
  };

  const selected = executions.find(e => e.id === selectedExecution);

  // Sort executions by timestamp (newest first) for display
  const sortedExecutions = [...executions].sort((a, b) => {
    // Try to parse timestamp for sorting, fallback to creation order
    const aTime = new Date(a.request?.timestamp || Date.now()).getTime();
    const bTime = new Date(b.request?.timestamp || Date.now()).getTime();
    return bTime - aTime; // Newest first
  });

  if (executions.length === 0) {
    return (
      <div
        className={`bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col h-full ${className}`}
        data-inspector="true"
      >
        <div className="border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between bg-white dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
              Request Inspector
            </h3>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            0 requests
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <Database className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium mb-2 text-sm text-gray-900 dark:text-gray-100">
              No tool executions yet
            </p>
            <p className="text-xs max-w-sm">
              {chatTitle
                ? `Execute tools in "${chatTitle}" to see request details`
                : connectionName
                  ? `Execute tools on ${connectionName} to see request details`
                  : "Execute tools to see request details"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col h-full ${className}`}
      data-inspector="true"
    >
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between bg-white dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
            Request Inspector
          </h3>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {executions.length} requests
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0">
        {/* Tool Execution List - 35% of space */}
        <div className="h-1/3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 flex flex-col">
          {/* Fixed Table Header */}
          <div className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 py-2 flex-shrink-0">
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-600 dark:text-gray-400">
              <div className="col-span-6 flex items-center gap-1">
                <span>Tool</span>
              </div>
              <div className="col-span-2 text-center">Status</div>
              <div className="col-span-2 text-center">Time</div>
              <div className="col-span-2 text-center">Duration</div>
            </div>
          </div>

          {/* Fixed Table Body */}
          <div className="overflow-y-auto flex-1">
            {sortedExecutions.map(execution => (
              <div
                key={execution.id}
                className={`px-3 py-2.5 border-b border-gray-100 dark:border-gray-800 cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 ${
                  selectedExecution === execution.id
                    ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700"
                    : ""
                }`}
                onClick={() => handleExecutionClick(execution.id)}
              >
                <div className="grid grid-cols-12 gap-2 items-center text-xs">
                  {/* Tool Name with Icon */}
                  <div className="col-span-6 flex items-center gap-1.5 min-w-0">
                    {getStatusIcon(execution.status)}
                    <span className="text-gray-900 dark:text-gray-100 truncate font-mono text-xs">
                      {execution.tool || "Unknown Tool"}
                    </span>
                  </div>

                  {/* Status */}
                  <div
                    className={`col-span-2 text-center font-medium text-xs ${getStatusColor(execution.status)}`}
                  >
                    {getStatusCode(execution.status)}
                  </div>

                  {/* Timestamp */}
                  <div className="col-span-2 text-center text-gray-500 dark:text-gray-400 text-xs">
                    {execution.timestamp || "—"}
                  </div>

                  {/* Duration */}
                  <div className="col-span-2 text-center text-gray-600 dark:text-gray-400 font-mono text-xs">
                    {formatDuration(execution.duration)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Request Details Panel - 65% of space */}
        <div className="h-2/3 overflow-hidden flex flex-col">
          {selected ? (
            <div className="h-full flex flex-col">
              {/* Details Header with more padding */}
              <div className="border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex-shrink-0 bg-white dark:bg-gray-900">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(selected.status)}
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                      {selected.tool || "Unknown Tool"}
                    </h4>
                    <span
                      className={`text-xs font-medium ${getStatusColor(selected.status)}`}
                    >
                      {selected.status === "pending"
                        ? "Pending"
                        : selected.status === "success"
                          ? "200 OK"
                          : "500 Error"}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {selected.timestamp || "—"} •{" "}
                    {formatDuration(selected.duration)}
                  </div>
                </div>
              </div>

              {/* Scrollable Details Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Request Section */}
                <div>
                  <div
                    className="flex items-center gap-2 pb-2 cursor-pointer"
                    onClick={() => toggleExpanded(`${selected.id}-request`)}
                  >
                    {expandedItems.has(`${selected.id}-request`) ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                    <h5 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                      Request
                    </h5>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        copyToClipboard(
                          JSON.stringify(selected.request, null, 2)
                        );
                      }}
                      className="ml-auto p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                      title="Copy request"
                    >
                      <Copy className="w-3 h-3 text-gray-400" />
                    </button>
                  </div>

                  {expandedItems.has(`${selected.id}-request`) && (
                    <div className="bg-gray-50 dark:bg-gray-950 rounded-lg p-3 border border-gray-200 dark:border-gray-800">
                      <pre className="text-xs text-gray-800 dark:text-gray-200 font-mono overflow-x-auto whitespace-pre-wrap break-all">
                        {JSON.stringify(selected.request, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Response/Error Section */}
                {(selected.response || selected.error) && (
                  <div>
                    <div
                      className="flex items-center gap-2 pb-2 cursor-pointer"
                      onClick={() => toggleExpanded(`${selected.id}-response`)}
                    >
                      {expandedItems.has(`${selected.id}-response`) ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                      <h5 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                        {selected.error ? "Error" : "Response"}
                      </h5>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          copyToClipboard(
                            JSON.stringify(
                              selected.response || selected.error,
                              null,
                              2
                            )
                          );
                        }}
                        className="ml-auto p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                        title="Copy response"
                      >
                        <Copy className="w-3 h-3 text-gray-400" />
                      </button>
                    </div>

                    {expandedItems.has(`${selected.id}-response`) && (
                      <div className="bg-gray-50 dark:bg-gray-950 rounded-lg p-3 border border-gray-200 dark:border-gray-800">
                        {selected.error ? (
                          <div className="text-gray-700 dark:text-gray-300 text-xs break-words">
                            {selected.error}
                          </div>
                        ) : (
                          <pre className="text-xs text-gray-800 dark:text-gray-200 font-mono overflow-x-auto whitespace-pre-wrap break-all">
                            {JSON.stringify(selected.response, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Summary Stats in a compact grid */}
                {selected.status === "success" && selected.duration && (
                  <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-200 dark:border-gray-800">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {formatDuration(selected.duration)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Response Time
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {
                          JSON.stringify(selected.response || selected.request)
                            .length
                        }
                        B
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Data Size
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                        {selected.status === "success" ? "✓" : "✗"}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Status
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400 p-4">
              <div className="text-center">
                <Database className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="font-medium mb-2 text-sm text-gray-900 dark:text-gray-100">
                  Select a request to view details
                </p>
                <p className="text-xs">
                  Click on a tool call above to see request and response data
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
