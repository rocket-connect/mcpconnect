// packages/components/src/NetworkInspector.tsx - Complete updated component
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
import React, { useState, useEffect } from "react";
import {
  ChevronRight,
  ChevronDown,
  Clock,
  Database,
  AlertCircle,
  CheckCircle,
  Copy,
  MessageSquare,
  ExternalLink,
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
  chatId,
  chatTitle,
  onToolCallClick,
  selectedExecution: externalSelectedExecution,
  className = "",
}) => {
  // Use external selectedExecution if provided, otherwise use internal state
  const [internalSelectedExecution, setInternalSelectedExecution] = useState<
    string | null
  >(executions[0]?.id || null);

  const selectedExecution =
    externalSelectedExecution !== undefined
      ? externalSelectedExecution
      : internalSelectedExecution;

  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Update internal state when external selection changes
  useEffect(() => {
    if (
      externalSelectedExecution !== undefined &&
      externalSelectedExecution !== null
    ) {
      setInternalSelectedExecution(externalSelectedExecution);
    }
  }, [externalSelectedExecution]);

  // Auto-expand details when an execution is selected externally
  useEffect(() => {
    if (selectedExecution) {
      const newExpanded = new Set(expandedItems);
      newExpanded.add(`${selectedExecution}-request`);
      newExpanded.add(`${selectedExecution}-response`);
      setExpandedItems(newExpanded);
    }
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
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case "error":
        return <AlertCircle className="w-3 h-3 text-red-500" />;
      case "pending":
        return <Clock className="w-3 h-3 text-blue-500 animate-pulse" />;
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
  };

  const handleExecutionClick = (executionId: string) => {
    if (externalSelectedExecution !== undefined) {
      // If controlled by external state, notify parent
      onToolCallClick?.(executionId);
    } else {
      // If using internal state, update local state
      setInternalSelectedExecution(executionId);
    }
  };

  const handleToolCallNavigation = (toolCallId: string) => {
    if (onToolCallClick) {
      onToolCallClick(toolCallId);
    }
  };

  const selected = executions.find(e => e.id === selectedExecution);

  // If no executions available, show empty state
  if (executions.length === 0) {
    return (
      <div
        className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex flex-col h-full ${className}`}
        data-inspector="true"
      >
        <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <h3 className="font-medium text-gray-900 dark:text-white">
              Request Inspector
            </h3>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            {connectionName && (
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                {connectionName}
              </span>
            )}
            {chatTitle && (
              <span className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
                <MessageSquare className="w-3 h-3" />
                {chatTitle}
              </span>
            )}
            <span>0 requests</span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No tool executions yet</p>
            <p className="text-sm">
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
      className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex flex-col h-full ${className}`}
      data-inspector="true"
    >
      {/* Header */}
      <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          <h3 className="font-medium text-gray-900 dark:text-white">
            Request Inspector
          </h3>
          {externalSelectedExecution && (
            <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
              Synced with Chat
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          {connectionName && (
            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
              {connectionName}
            </span>
          )}
          {chatTitle && (
            <span className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
              <MessageSquare className="w-3 h-3" />
              {chatTitle}
            </span>
          )}
          <span>{executions.length} requests</span>
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0">
        {/* Tool Execution List - Top Half */}
        <div className="flex-1 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 min-h-0">
          {/* List Header */}
          <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <div className="col-span-4">Tool</div>
            <div className="col-span-2 text-center">Status</div>
            <div className="col-span-2 text-right">Duration</div>
            <div className="col-span-3 text-right">Time</div>
            <div className="col-span-1 text-center">Link</div>
          </div>

          {/* Execution List with Scroll */}
          <div className="overflow-y-auto h-full">
            {executions.map(execution => (
              <div
                key={execution.id}
                className={`grid grid-cols-12 gap-2 px-3 py-2 text-xs border-b border-gray-100 dark:border-gray-700 cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-700/50 ${
                  selectedExecution === execution.id
                    ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                    : ""
                }`}
                onClick={() => handleExecutionClick(execution.id)}
              >
                <div className="col-span-4 flex items-center gap-1 min-w-0">
                  {getStatusIcon(execution.status)}
                  <span className="text-gray-900 dark:text-white truncate font-mono">
                    {execution.tool}
                  </span>
                </div>
                <div
                  className={`col-span-2 text-center font-medium ${getStatusColor(execution.status)}`}
                >
                  {execution.status === "pending"
                    ? "..."
                    : execution.status === "success"
                      ? "200"
                      : "500"}
                </div>
                <div className="col-span-2 text-right text-gray-600 dark:text-gray-400 font-mono">
                  {formatDuration(execution.duration)}
                </div>
                <div className="col-span-3 text-right text-gray-500 dark:text-gray-400">
                  {execution.timestamp}
                </div>
                <div className="col-span-1 flex justify-center">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleToolCallNavigation(execution.id);
                    }}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                    title="Go to chat message"
                  >
                    <ExternalLink className="w-3 h-3 text-gray-400 hover:text-blue-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Request Details Panel - Bottom Half */}
        <div className="flex-1 overflow-hidden min-h-0">
          {selected ? (
            <div className="h-full flex flex-col">
              {/* Details Header */}
              <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(selected.status)}
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {selected.tool}
                    </h4>
                    <span
                      className={`text-sm font-medium ${getStatusColor(selected.status)}`}
                    >
                      {selected.status === "pending"
                        ? "Pending"
                        : selected.status === "success"
                          ? "200 OK"
                          : "500 Error"}
                    </span>
                    {externalSelectedExecution === selected.id && (
                      <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                        Synced with Chat
                      </span>
                    )}
                    {chatId && (
                      <button
                        onClick={() => handleToolCallNavigation(selected.id)}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View in Chat
                      </button>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {selected.timestamp} • {formatDuration(selected.duration)}
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
                    <h5 className="font-medium text-gray-900 dark:text-white">
                      Request
                    </h5>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        copyToClipboard(
                          JSON.stringify(selected.request, null, 2)
                        );
                      }}
                      className="ml-auto p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      title="Copy request"
                    >
                      <Copy className="w-3 h-3 text-gray-400" />
                    </button>
                  </div>

                  {expandedItems.has(`${selected.id}-request`) && (
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                      <pre className="text-xs text-gray-800 dark:text-gray-200 font-mono overflow-x-auto whitespace-pre-wrap">
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
                      <h5 className="font-medium text-gray-900 dark:text-white">
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
                        className="ml-auto p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        title="Copy response"
                      >
                        <Copy className="w-3 h-3 text-gray-400" />
                      </button>
                    </div>

                    {expandedItems.has(`${selected.id}-response`) && (
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                        {selected.error ? (
                          <div className="text-red-600 dark:text-red-400 text-sm">
                            {selected.error}
                          </div>
                        ) : (
                          <pre className="text-xs text-gray-800 dark:text-gray-200 font-mono overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(selected.response, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Summary Stats */}
                {selected.status === "success" && selected.duration && (
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                        {formatDuration(selected.duration)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Response Time
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                        {
                          JSON.stringify(selected.response || selected.request)
                            .length
                        }
                        B
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Data Size
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                        {selected.status === "success" ? "✓" : "✗"}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Status
                      </div>
                    </div>
                  </div>
                )}

                {/* Sync indicator for external control */}
                {externalSelectedExecution === selected.id && (
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      This tool call is synchronized with the chat interface
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a request to view details</p>
                {externalSelectedExecution !== undefined && (
                  <p className="text-xs mt-2">
                    Inspector is synchronized with chat interface
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
