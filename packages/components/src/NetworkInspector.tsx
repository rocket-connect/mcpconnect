/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
import React, { useState } from "react";
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
  className?: string;
}

export const NetworkInspector: React.FC<NetworkInspectorProps> = ({
  executions = [
    {
      id: "1",
      tool: "query_database",
      status: "success",
      duration: 142,
      timestamp: "10:30:47",
      request: {
        tool: "query_database",
        arguments: {
          query:
            "SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '1 month'",
          timeout: 5000,
        },
      },
      response: {
        success: true,
        result: { count: 47, execution_time: 142 },
      },
    },
    {
      id: "2",
      tool: "get_schema",
      status: "success",
      duration: 89,
      timestamp: "10:29:15",
      request: {
        tool: "get_schema",
        arguments: { table: "users" },
      },
      response: {
        success: true,
        result: {
          columns: [
            { name: "id", type: "INTEGER", nullable: false },
            { name: "email", type: "VARCHAR", nullable: false },
            { name: "created_at", type: "TIMESTAMP", nullable: false },
          ],
        },
      },
    },
    {
      id: "3",
      tool: "backup_data",
      status: "error",
      duration: 2341,
      timestamp: "10:25:32",
      request: {
        tool: "backup_data",
        arguments: { format: "sql", compress: true },
      },
      error: "Permission denied: insufficient privileges for backup operation",
    },
    {
      id: "4",
      tool: "query_database",
      status: "pending",
      timestamp: "10:30:50",
      request: {
        tool: "query_database",
        arguments: {
          query:
            "SELECT * FROM orders WHERE status = 'pending' ORDER BY created_at DESC LIMIT 10",
        },
      },
    },
  ],
  className = "",
}) => {
  const [selectedExecution, setSelectedExecution] = useState<string | null>(
    executions[0]?.id || null
  );
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

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

  const selected = executions.find(e => e.id === selectedExecution);

  return (
    <div
      className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex flex-col h-full ${className}`}
    >
      {/* Header */}
      <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          <h3 className="font-medium text-gray-900 dark:text-white">
            Request Inspector
          </h3>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {executions.length} requests
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0">
        {/* Tool Execution List - Top Half */}
        <div className="flex-1 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 min-h-0">
          {/* List Header */}
          <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <div className="col-span-5">Tool</div>
            <div className="col-span-2 text-center">Status</div>
            <div className="col-span-3 text-right">Duration</div>
            <div className="col-span-2 text-right">Time</div>
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
                onClick={() => setSelectedExecution(execution.id)}
              >
                <div className="col-span-5 flex items-center gap-1 min-w-0">
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
                <div className="col-span-3 text-right text-gray-600 dark:text-gray-400 font-mono">
                  {formatDuration(execution.duration)}
                </div>
                <div className="col-span-2 text-right text-gray-500 dark:text-gray-400">
                  {execution.timestamp}
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
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a request to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
