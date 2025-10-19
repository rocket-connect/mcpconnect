/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
import React, { useState, useEffect, useRef, useMemo } from "react";
import { ToolExecution } from "@mcpconnect/schemas";
import { JsonCodeBlock, parseTimestampToNumber } from "../common/JsonCodeBlock";
import { ExecutionSearchBar } from "./ExecutionSearchBar";
import { ExecutionTableHeader } from "./ExecutionTableHeader";
import { ExecutionEmptyState } from "./ExecutionEmptyState";
import { ExecutionRow } from "./ExecutionRow";
import { RequestDetailsPanel } from "./RequestDetailsPanel";
import { ExpandableSection } from "./ExpandableSection";
import { createDemoExecutions } from "./demoExecutions";

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
  manualExecutions?: ToolExecution[];
  isManualContext?: boolean;
  onDeleteExecution?: (executionId: string) => void;
  hiddenExecutions?: Set<string>;
}

export const NetworkInspector: React.FC<NetworkInspectorProps> = ({
  executions = [],
  connectionId,
  onToolCallClick,
  selectedExecution: externalSelectedExecution,
  className = "",
  hasAnyConnections = false,
  chatHasToolCalls = false,
  manualExecutions = [],
  isManualContext = false,
  onDeleteExecution,
  hiddenExecutions = new Set(),
}) => {
  const [internalSelectedExecution, setInternalSelectedExecution] = useState<
    string | null
  >(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<
    "tool" | "status" | "time" | "duration"
  >("time");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

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

    if (isManualContext) {
      // ✅ ONLY show manual executions in manual context
      return manualExecutions;
    }

    if (!chatHasToolCalls && manualExecutions.length === 0) {
      return [];
    }

    return executions;
  }, [
    showDemoData,
    demoExecutions,
    isManualContext,
    manualExecutions,
    chatHasToolCalls,
    executions,
  ]);

  // Filter out hidden executions
  const visibleExecutions = useMemo(() => {
    return displayExecutions.filter(exec => !hiddenExecutions.has(exec.id));
  }, [displayExecutions, hiddenExecutions]);

  useEffect(() => {
    if (showDemoData && !selectedExecution && demoExecutions.length > 0) {
      setInternalSelectedExecution(demoExecutions[0].id);
    } else if (visibleExecutions.length > prevExecutionsRef.current.length) {
      const newExecutions = visibleExecutions.slice(
        prevExecutionsRef.current.length
      );
      const mostRecentExecution = newExecutions[newExecutions.length - 1];

      if (mostRecentExecution && externalSelectedExecution === undefined) {
        setInternalSelectedExecution(mostRecentExecution.id);
      }
    }

    prevExecutionsRef.current = visibleExecutions;
  }, [
    visibleExecutions,
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

  const handleDeleteExecution = (executionId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (showDemoData) return;

    const confirmed = confirm(
      "Are you sure you want to hide this request? It will no longer appear in the inspector."
    );

    if (confirmed && onDeleteExecution) {
      onDeleteExecution(executionId);

      // If the deleted execution was selected, clear selection
      if (selectedExecution === executionId) {
        setInternalSelectedExecution(null);
      }
    }
  };

  const selected = visibleExecutions.find(e => e.id === selectedExecution);

  const filteredExecutions = useMemo(() => {
    if (!searchQuery.trim()) {
      return visibleExecutions;
    }

    const query = searchQuery.toLowerCase();
    return visibleExecutions.filter(execution => {
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
  }, [visibleExecutions, searchQuery]);

  const sortedExecutions = useMemo(() => {
    const sorted = [...filteredExecutions].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "tool":
          comparison = (a.tool || "").localeCompare(b.tool || "");
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
        case "time": {
          const aTime = parseTimestampToNumber(
            a.request?.timestamp || a.timestamp || Date.now()
          );
          const bTime = parseTimestampToNumber(
            b.request?.timestamp || b.timestamp || Date.now()
          );
          comparison = aTime - bTime;
          break;
        }
        case "duration": {
          const aDuration = a.duration || 0;
          const bDuration = b.duration || 0;
          comparison = aDuration - bDuration;
          break;
        }
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [filteredExecutions, sortField, sortDirection]);

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

    if (isManualContext) {
      return {
        title: "No executions yet",
        subtitle:
          "Tool executions from manual execution and chat will appear here",
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

  const getHeaderTitle = () => {
    if (isManualContext) {
      return `Request Inspector`;
    }
    return "Request Inspector";
  };

  return (
    <div
      className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 flex flex-col h-full ${className} ${showDemoData ? "opacity-75" : ""}`}
      data-inspector="true"
    >
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between bg-white dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 text-gray-600 dark:text-gray-400">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 7v10c0 2.21 1.79 4 4 4h8c2.21 0 4-1.79 4-4V7c0-2.21-1.79-4-4-4H8c-2.21 0-4 1.79-4 4z"
              />
            </svg>
          </div>
          <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
            {getHeaderTitle()}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {showDemoData && (
            <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
              <div className="w-3 h-3 text-blue-600 dark:text-blue-400">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                Demo
              </span>
            </div>
          )}
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {filteredExecutions.length} of {visibleExecutions.length} requests
            {searchQuery &&
              filteredExecutions.length !== visibleExecutions.length && (
                <span className="ml-1 text-blue-600 dark:text-blue-400">
                  (filtered)
                </span>
              )}
          </div>
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0">
        {/* Tool Execution List - Dynamic height based on selection */}
        <div
          className={`border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 flex flex-col ${selected ? "h-1/2" : "flex-1"}`}
        >
          {visibleExecutions.length > 0 && (
            <ExecutionSearchBar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              showDemoData={showDemoData}
            />
          )}

          {visibleExecutions.length > 0 && (
            <ExecutionTableHeader
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={field => {
                if (sortField === field) {
                  setSortDirection(prev => (prev === "asc" ? "desc" : "asc"));
                } else {
                  setSortField(field);
                  setSortDirection("desc");
                }
              }}
            />
          )}

          <div className="overflow-y-auto flex-1">
            {sortedExecutions.length === 0 ? (
              <ExecutionEmptyState
                searchQuery={searchQuery}
                displayExecutionsLength={visibleExecutions.length}
                showDemoData={showDemoData}
                emptyStateSubtitle={emptyState.subtitle}
                onClearSearch={() => setSearchQuery("")}
              />
            ) : (
              sortedExecutions.map((execution, index) => (
                <ExecutionRow
                  key={execution.id}
                  execution={execution}
                  index={index}
                  totalExecutions={sortedExecutions.length}
                  isSelected={selectedExecution === execution.id}
                  showDemoData={showDemoData}
                  onExecutionClick={handleExecutionClick}
                  onDeleteExecution={handleDeleteExecution}
                />
              ))
            )}
          </div>
        </div>

        {/* Request Details Panel - Compact when nothing selected */}
        <div
          className={`overflow-hidden flex flex-col bg-white dark:bg-gray-900 ${selected ? "h-1/2" : "h-12"}`}
        >
          {selected ? (
            <div className="h-full flex flex-col">
              <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex-shrink-0 bg-white dark:bg-gray-900">
                <RequestDetailsPanel
                  selected={selected}
                  showDemoData={showDemoData}
                  emptyStateTitle={emptyState.title}
                  emptyStateSubtitle={emptyState.subtitle}
                />
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                <ExpandableSection
                  id={`${selected.id}-request`}
                  title="Request"
                  icon={
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
                  }
                  isExpanded={expandedItems.has(`${selected.id}-request`)}
                  onToggle={toggleExpanded}
                >
                  <JsonCodeBlock
                    data={selected.request}
                    onCopy={() =>
                      copyToClipboard(JSON.stringify(selected.request, null, 2))
                    }
                    showDemo={showDemoData}
                  />
                </ExpandableSection>

                {(selected.response || selected.error) && (
                  <ExpandableSection
                    id={`${selected.id}-response`}
                    title={selected.error ? "Error" : "Response"}
                    icon={
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
                    }
                    isExpanded={expandedItems.has(`${selected.id}-response`)}
                    onToggle={toggleExpanded}
                  >
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
                  </ExpandableSection>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                {visibleExecutions.length > 0
                  ? "Select a request above to view details"
                  : emptyState.subtitle}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
