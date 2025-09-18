/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  ChevronRight,
  ChevronDown,
  Clock,
  Database,
  AlertCircle,
  CheckCircle,
  Copy,
  Search,
  X,
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

  const [searchQuery, setSearchQuery] = useState("");

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

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for non-secure contexts
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }
    } catch (err) {
      console.warn("Failed to copy text: ", err);
    }
  };

  const handleExecutionClick = (executionId: string) => {
    if (externalSelectedExecution !== undefined) {
      onToolCallClick?.(executionId);
    } else {
      setInternalSelectedExecution(executionId);
    }
  };

  const selected = executions.find(e => e.id === selectedExecution);

  // Filter executions based on search query
  const filteredExecutions = useMemo(() => {
    if (!searchQuery.trim()) {
      return executions;
    }

    const query = searchQuery.toLowerCase();
    return executions.filter(execution => {
      const toolName = (execution.tool || "").toLowerCase();
      const status = execution.status.toLowerCase();
      const timestamp = (execution.timestamp || "").toLowerCase();

      return (
        toolName.includes(query) ||
        status.includes(query) ||
        timestamp.includes(query) ||
        (execution.request &&
          JSON.stringify(execution.request).toLowerCase().includes(query)) ||
        (execution.response &&
          JSON.stringify(execution.response).toLowerCase().includes(query)) ||
        (execution.error && execution.error.toLowerCase().includes(query))
      );
    });
  }, [executions, searchQuery]);

  // Helper function to safely parse timestamps to numbers
  const parseTimestampToNumber = (timestamp: any): number => {
    if (typeof timestamp === "number") {
      return timestamp;
    }

    if (timestamp instanceof Date) {
      return timestamp.getTime();
    }

    if (typeof timestamp === "string") {
      // Try to parse as ISO string first
      const parsed = new Date(timestamp);
      if (!isNaN(parsed.getTime())) {
        return parsed.getTime();
      }

      // If that fails, try to parse as a number string
      const numericTimestamp = parseInt(timestamp, 10);
      if (!isNaN(numericTimestamp)) {
        return numericTimestamp;
      }
    }

    // Fallback to current time
    return Date.now();
  };

  // Sort filtered executions by timestamp (newest first) for display
  const sortedExecutions = useMemo(() => {
    return [...filteredExecutions].sort((a, b) => {
      // Try to parse timestamp for sorting, fallback to creation order
      const aTime = parseTimestampToNumber(
        a.request?.timestamp || a.timestamp || Date.now()
      );
      const bTime = parseTimestampToNumber(
        b.request?.timestamp || b.timestamp || Date.now()
      );
      return bTime - aTime; // Newest first
    });
  }, [filteredExecutions]);

  // Enhanced timestamp formatting function
  const formatTimestamp = (execution: ToolExecution) => {
    const timestamp = execution.timestamp || execution.request?.timestamp;

    if (!timestamp) return "—";

    try {
      let date: Date;

      // @ts-ignore
      if (timestamp instanceof Date) {
        date = timestamp;
      } else if (typeof timestamp === "string") {
        // Try parsing as ISO string first
        date = new Date(timestamp);

        // If invalid, try parsing as number string
        if (isNaN(date.getTime())) {
          const numericTimestamp = parseInt(timestamp, 10);
          if (!isNaN(numericTimestamp)) {
            date = new Date(numericTimestamp);
          } else {
            return "Invalid Date";
          }
        }
      } else if (typeof timestamp === "number") {
        date = new Date(timestamp);
      } else {
        return "—";
      }

      // Validate the date is actually valid
      if (isNaN(date.getTime())) {
        return "Invalid Date";
      }

      return date.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch (error) {
      console.warn("Error formatting timestamp:", timestamp, error);
      return "Invalid Date";
    }
  };

  if (executions.length === 0) {
    return (
      <div
        className={`bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 flex flex-col h-full ${className}`}
        data-inspector="true"
      >
        {/* Header with proper border */}
        <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between bg-white dark:bg-gray-900">
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
      className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 flex flex-col h-full ${className}`}
      data-inspector="true"
    >
      {/* Header with consistent borders */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between bg-white dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
            Request Inspector
          </h3>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {filteredExecutions.length} of {executions.length} requests
          {searchQuery && filteredExecutions.length !== executions.length && (
            <span className="ml-1 text-blue-600 dark:text-blue-400">
              (filtered)
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0">
        {/* Tool Execution List - 35% of space with proper borders */}
        <div className="h-1/3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 flex flex-col">
          {/* Search Bar */}
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-3.5 w-3.5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search tool executions..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="block w-full pl-9 pr-8 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-0 pr-2 flex items-center"
                  type="button"
                >
                  <X className="h-3 w-3 text-gray-400 hover:text-gray-600 transition-colors" />
                </button>
              )}
            </div>
          </div>

          {/* Fixed Table Header with border */}
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

          {/* Fixed Table Body with proper borders */}
          <div className="overflow-y-auto flex-1">
            {sortedExecutions.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400">
                <div className="text-center">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">
                    {searchQuery
                      ? `No executions match "${searchQuery}"`
                      : "No tool executions yet"}
                  </p>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      type="button"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              </div>
            ) : (
              sortedExecutions.map((execution, index) => (
                <div
                  key={execution.id}
                  className={`px-3 py-2.5 cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 ${
                    selectedExecution === execution.id
                      ? "bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500"
                      : ""
                  }${
                    index < sortedExecutions.length - 1
                      ? " border-b border-gray-100 dark:border-gray-800"
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
                      {formatTimestamp(execution)}
                    </div>

                    {/* Duration */}
                    <div className="col-span-2 text-center text-gray-600 dark:text-gray-400 font-mono text-xs">
                      {formatDuration(execution.duration)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Request Details Panel - 65% of space with proper borders */}
        <div className="h-2/3 overflow-hidden flex flex-col bg-white dark:bg-gray-900">
          {selected ? (
            <div className="h-full flex flex-col">
              {/* Details Header with consistent border */}
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
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formatTimestamp(selected)} •{" "}
                    {formatDuration(selected.duration)}
                  </div>
                </div>
              </div>

              {/* Scrollable Details Content with proper internal borders and bottom padding */}
              <div className="flex-1 overflow-y-auto p-4 pb-8 space-y-4">
                {/* Request Section with border */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div
                    className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    onClick={() => toggleExpanded(`${selected.id}-request`)}
                  >
                    {expandedItems.has(`${selected.id}-request`) ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                    <h5 className="font-semibold text-gray-900 dark:text-gray-100 text-sm flex-1">
                      Request
                    </h5>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        copyToClipboard(
                          JSON.stringify(selected.request, null, 2)
                        );
                      }}
                      className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                      title="Copy request"
                      type="button"
                    >
                      <Copy className="w-3 h-3 text-gray-400" />
                    </button>
                  </div>

                  {expandedItems.has(`${selected.id}-request`) && (
                    <div className="p-4 bg-white dark:bg-gray-900">
                      <pre className="text-xs text-gray-800 dark:text-gray-200 font-mono overflow-x-auto whitespace-pre-wrap break-all bg-gray-50 dark:bg-gray-950 p-3 rounded border border-gray-200 dark:border-gray-700">
                        {JSON.stringify(selected.request, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Response/Error Section with border */}
                {(selected.response || selected.error) && (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <div
                      className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => toggleExpanded(`${selected.id}-response`)}
                    >
                      {expandedItems.has(`${selected.id}-response`) ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                      <h5 className="font-semibold text-gray-900 dark:text-gray-100 text-sm flex-1">
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
                        className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                        title="Copy response"
                        type="button"
                      >
                        <Copy className="w-3 h-3 text-gray-400" />
                      </button>
                    </div>

                    {expandedItems.has(`${selected.id}-response`) && (
                      <div className="p-4 bg-white dark:bg-gray-900">
                        {selected.error ? (
                          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-800 dark:text-red-200 text-sm">
                            {selected.error}
                          </div>
                        ) : (
                          <pre className="text-xs text-gray-800 dark:text-gray-200 font-mono overflow-x-auto whitespace-pre-wrap break-all bg-gray-50 dark:bg-gray-950 p-3 rounded border border-gray-200 dark:border-gray-700">
                            {JSON.stringify(selected.response, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Summary Stats in a bordered card */}
                {selected.status === "success" && selected.duration && (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                    <h5 className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-3">
                      Execution Summary
                    </h5>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                        <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {formatDuration(selected.duration)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Response Time
                        </div>
                      </div>
                      <div className="text-center p-3 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                        <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {(() => {
                            const size = JSON.stringify(
                              selected.response || selected.request
                            ).length;
                            return size > 1024
                              ? `${(size / 1024).toFixed(1)}KB`
                              : `${size}B`;
                          })()}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Data Size
                        </div>
                      </div>
                      <div className="text-center p-3 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                        <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                          {selected.status === "success" ? "✓" : "✗"}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Status
                        </div>
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
