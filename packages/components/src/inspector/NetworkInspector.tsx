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
  Search,
  X,
  Sparkles,
} from "lucide-react";
import { ToolExecution } from "@mcpconnect/schemas";
import {
  JsonCodeBlock,
  parseTimestampToNumber,
  formatTimestamp,
} from "../common/JsonCodeBlock";

export interface NetworkInspectorProps {
  executions?: ToolExecution[];
  connectionId?: string;
  connectionName?: string;
  chatId?: string;
  chatTitle?: string;
  onToolCallClick?: (toolCallId: string) => void;
  selectedExecution?: string | null;
  className?: string;
  hasAnyConnections?: boolean;
  chatHasToolCalls?: boolean;
}

// Demo tool executions for onboarding
const createDemoExecutions = (): ToolExecution[] => [
  {
    id: "demo-1",
    tool: "repo_browse",
    status: "success",
    duration: 850,
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    request: {
      tool: "repo_browse",
      arguments: {
        path: "/src/components",
        recursive: true,
      },
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
    response: {
      success: true,
      result: {
        files: [
          { name: "Header.tsx", type: "file", size: 2048 },
          { name: "Sidebar.tsx", type: "file", size: 3421 },
          { name: "ChatInterface.tsx", type: "file", size: 8192 },
        ],
        total_files: 12,
        total_directories: 3,
      },
      timestamp: new Date(Date.now() - 5 * 60 * 1000 + 850).toISOString(),
    },
  },
  {
    id: "demo-2",
    tool: "list_issues",
    status: "success",
    duration: 1200,
    timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    request: {
      tool: "list_issues",
      arguments: {
        repository: "mcpconnect/ui",
        state: "open",
        labels: ["bug", "enhancement"],
      },
      timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    },
    response: {
      success: true,
      result: {
        issues: [
          {
            id: 42,
            title: "Dark mode toggle not persisting",
            state: "open",
            labels: ["bug", "ui"],
            created_at: "2024-01-15T10:30:00Z",
          },
          {
            id: 38,
            title: "Add keyboard shortcuts for chat navigation",
            state: "open",
            labels: ["enhancement", "ux"],
            created_at: "2024-01-12T14:22:00Z",
          },
        ],
        total_count: 7,
      },
      timestamp: new Date(Date.now() - 3 * 60 * 1000 + 1200).toISOString(),
    },
  },
  {
    id: "demo-3",
    tool: "create_pr",
    status: "error",
    duration: 2100,
    timestamp: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    request: {
      tool: "create_pr",
      arguments: {
        title: "Fix dark mode persistence issue",
        body: "This PR addresses the bug where dark mode setting was not being saved to localStorage properly.",
        head: "fix/dark-mode-persistence",
        base: "main",
      },
      timestamp: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    },
    error:
      "Authentication failed: insufficient permissions to create pull request. User needs 'write' access to the repository.",
  },
  {
    id: "demo-4",
    tool: "web_search",
    status: "pending",
    timestamp: new Date().toISOString(),
    request: {
      tool: "web_search",
      arguments: {
        query: "React TypeScript best practices 2024",
        max_results: 5,
      },
      timestamp: new Date().toISOString(),
    },
  },
];

export const NetworkInspector: React.FC<NetworkInspectorProps> = ({
  executions = [],
  connectionId,
  onToolCallClick,
  selectedExecution: externalSelectedExecution,
  className = "",
  hasAnyConnections = false,
  chatHasToolCalls = false,
}) => {
  const [internalSelectedExecution, setInternalSelectedExecution] = useState<
    string | null
  >(null);

  const [searchQuery, setSearchQuery] = useState("");

  const selectedExecution =
    externalSelectedExecution !== undefined
      ? externalSelectedExecution
      : internalSelectedExecution;

  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const prevExecutionsRef = useRef<ToolExecution[]>([]);

  const showDemoData = !hasAnyConnections;
  const demoExecutions = useMemo(() => createDemoExecutions(), []);

  const displayExecutions = useMemo(() => {
    if (showDemoData) {
      return demoExecutions;
    }
    if (!chatHasToolCalls) {
      return [];
    }
    return executions;
  }, [showDemoData, demoExecutions, chatHasToolCalls, executions]);

  // Auto-select most recent execution when new ones arrive or in demo mode
  useEffect(() => {
    if (showDemoData && !selectedExecution && demoExecutions.length > 0) {
      setInternalSelectedExecution(demoExecutions[0].id);
    } else if (displayExecutions.length > prevExecutionsRef.current.length) {
      const newExecutions = displayExecutions.slice(
        prevExecutionsRef.current.length
      );
      const mostRecentExecution = newExecutions[newExecutions.length - 1];

      if (mostRecentExecution && externalSelectedExecution === undefined) {
        setInternalSelectedExecution(mostRecentExecution.id);
      }
    }

    prevExecutionsRef.current = displayExecutions;
  }, [
    displayExecutions,
    externalSelectedExecution,
    showDemoData,
    demoExecutions,
    selectedExecution,
  ]);

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

  const selected = displayExecutions.find(e => e.id === selectedExecution);

  const filteredExecutions = useMemo(() => {
    if (!searchQuery.trim()) {
      return displayExecutions;
    }

    const query = searchQuery.toLowerCase();
    return displayExecutions.filter(execution => {
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
  }, [displayExecutions, searchQuery]);

  const sortedExecutions = useMemo(() => {
    return [...filteredExecutions].sort((a, b) => {
      const aTime = parseTimestampToNumber(
        a.request?.timestamp || a.timestamp || Date.now()
      );
      const bTime = parseTimestampToNumber(
        b.request?.timestamp || b.timestamp || Date.now()
      );
      return bTime - aTime;
    });
  }, [filteredExecutions]);

  const getEmptyStateMessage = () => {
    if (showDemoData) {
      return {
        title: "Demo: Select a request to view details",
        subtitle: "Demo requests will show their data when selected",
      };
    }

    if (!hasAnyConnections) {
      return {
        title: "No connections yet",
        subtitle: "Create a connection to see tool executions here",
      };
    }

    if (!connectionId) {
      return {
        title: "Select a connection",
        subtitle: "Choose a connection to view its tool executions",
      };
    }

    if (!chatHasToolCalls) {
      return {
        title: "No tool executions yet",
        subtitle: "Tool executions from this chat will appear here",
      };
    }

    return {
      title: "No tool executions",
      subtitle: "Tool executions will appear here as they occur",
    };
  };

  const emptyState = getEmptyStateMessage();

  return (
    <div
      className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 flex flex-col h-full ${className} ${showDemoData ? "opacity-75" : ""}`}
      data-inspector="true"
    >
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between bg-white dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
            Request Inspector
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {showDemoData && (
            <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
              <Sparkles className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                Demo
              </span>
            </div>
          )}
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {filteredExecutions.length} of {displayExecutions.length} requests
            {searchQuery &&
              filteredExecutions.length !== displayExecutions.length && (
                <span className="ml-1 text-blue-600 dark:text-blue-400">
                  (filtered)
                </span>
              )}
          </div>
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0">
        {/* Tool Execution List */}
        <div className="h-1/3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 flex flex-col">
          {/* Search Bar */}
          {displayExecutions.length > 0 && (
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
                  disabled={showDemoData}
                  className="block w-full pl-9 pr-8 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-colors disabled:cursor-not-allowed"
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
          )}

          {/* Table Header */}
          {displayExecutions.length > 0 && (
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
          )}

          {/* Table Body */}
          <div className="overflow-y-auto flex-1">
            {sortedExecutions.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400">
                <div className="text-center">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">
                    {searchQuery
                      ? `No executions match "${searchQuery}"`
                      : displayExecutions.length === 0
                        ? showDemoData
                          ? "Demo tool executions will appear here"
                          : emptyState.subtitle
                        : "No executions to display"}
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
                  } ${showDemoData ? "opacity-75" : ""}`}
                  onClick={() =>
                    !showDemoData && handleExecutionClick(execution.id)
                  }
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
                      {formatTimestamp(
                        execution.timestamp || execution.request?.timestamp
                      )}
                    </div>

                    <div className="col-span-2 text-center text-gray-600 dark:text-gray-400 font-mono text-xs">
                      {formatDuration(execution.duration)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Request Details Panel */}
        <div className="h-2/3 overflow-hidden flex flex-col bg-white dark:bg-gray-900">
          {selected ? (
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
                    {formatTimestamp(
                      selected.timestamp || selected.request?.timestamp
                    )}{" "}
                    • {formatDuration(selected.duration)}
                  </div>
                </div>
              </div>

              {/* Scrollable Details Content - More Compact */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {/* Request Section - Inline Style */}
                <div>
                  <div
                    className="flex items-center gap-2 p-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md transition-colors"
                    onClick={() => toggleExpanded(`${selected.id}-request`)}
                  >
                    {expandedItems.has(`${selected.id}-request`) ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                    <svg
                      className="w-4 h-4 text-blue-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.955 8.955 0 01-4.126-.98L3 21l1.98-5.874A8.955 8.955 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z"
                      />
                    </svg>
                    <h5 className="font-medium text-gray-900 dark:text-gray-100 text-sm flex-1">
                      Request
                    </h5>
                  </div>

                  {expandedItems.has(`${selected.id}-request`) && (
                    <div className="ml-6 mt-2">
                      <JsonCodeBlock
                        data={selected.request}
                        onCopy={() =>
                          copyToClipboard(
                            JSON.stringify(selected.request, null, 2)
                          )
                        }
                        showDemo={showDemoData}
                      />
                    </div>
                  )}
                </div>

                {/* Response/Error Section - Inline Style */}
                {(selected.response || selected.error) && (
                  <div>
                    <div
                      className="flex items-center gap-2 p-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md transition-colors"
                      onClick={() => toggleExpanded(`${selected.id}-response`)}
                    >
                      {expandedItems.has(`${selected.id}-response`) ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                      <svg
                        className={`w-4 h-4 ${selected.error ? "text-red-500" : "text-green-500"}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        {selected.error ? (
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                          />
                        ) : (
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        )}
                      </svg>
                      <h5 className="font-medium text-gray-900 dark:text-gray-100 text-sm flex-1">
                        {selected.error ? "Error" : "Response"}
                      </h5>
                    </div>

                    {expandedItems.has(`${selected.id}-response`) && (
                      <div className="ml-6 mt-2">
                        {selected.error ? (
                          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-800 dark:text-red-200 text-sm font-mono">
                            {selected.error}
                          </div>
                        ) : (
                          <JsonCodeBlock
                            data={selected.response}
                            onCopy={() =>
                              copyToClipboard(
                                JSON.stringify(selected.response, null, 2)
                              )
                            }
                            showDemo={showDemoData}
                          />
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Metadata Section - Compact */}
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">
                        Tool:
                      </span>
                      <span className="font-mono text-gray-900 dark:text-gray-100">
                        {selected.tool || "Unknown"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">
                        Duration:
                      </span>
                      <span className="text-gray-900 dark:text-gray-100">
                        {formatDuration(selected.duration)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">
                        Status:
                      </span>
                      <span
                        className={`font-medium ${getStatusColor(selected.status)}`}
                      >
                        {selected.status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">
                        Time:
                      </span>
                      <span className="text-gray-900 dark:text-gray-100">
                        {formatTimestamp(
                          selected.timestamp || selected.request?.timestamp
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400 p-4">
              <div className="text-center">
                <Database className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="font-medium mb-2 text-sm text-gray-900 dark:text-gray-100">
                  {emptyState.title}
                </p>
                <p className="text-xs">{emptyState.subtitle}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
