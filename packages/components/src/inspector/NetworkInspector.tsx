/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
import React, { useState, useEffect, useRef, useMemo } from "react";
import { ToolExecution } from "@mcpconnect/schemas";
import { JsonCodeBlock, parseTimestampToNumber } from "../common/JsonCodeBlock";
import { InspectorHeader } from "./InspectorHeader";
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
}

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
      <InspectorHeader
        showDemoData={showDemoData}
        filteredExecutionsCount={filteredExecutions.length}
        totalExecutionsCount={displayExecutions.length}
        searchQuery={searchQuery}
      />

      <div className="flex flex-col flex-1 min-h-0">
        {/* Tool Execution List */}
        <div className="h-1/3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 flex flex-col">
          {/* Search Bar */}
          {displayExecutions.length > 0 && (
            <ExecutionSearchBar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              showDemoData={showDemoData}
            />
          )}

          {/* Table Header */}
          {displayExecutions.length > 0 && <ExecutionTableHeader />}

          {/* Table Body */}
          <div className="overflow-y-auto flex-1">
            {sortedExecutions.length === 0 ? (
              <ExecutionEmptyState
                searchQuery={searchQuery}
                displayExecutionsLength={displayExecutions.length}
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
                />
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
                <RequestDetailsPanel
                  selected={selected}
                  showDemoData={showDemoData}
                  emptyStateTitle={emptyState.title}
                  emptyStateSubtitle={emptyState.subtitle}
                />
              </div>

              {/* Scrollable Details Content - More Compact */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {/* Request Section - Inline Style */}
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

                {/* Response/Error Section - Inline Style */}
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
            <RequestDetailsPanel
              selected={selected}
              showDemoData={showDemoData}
              emptyStateTitle={emptyState.title}
              emptyStateSubtitle={emptyState.subtitle}
            />
          )}
        </div>
      </div>
    </div>
  );
};
