import { Connection, Tool, Resource } from "@mcpconnect/schemas";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { RconnectLogo } from "./RconnectLogo";
import { useStorage } from "../contexts/StorageContext";
import { Search, X, MoreHorizontal, CheckCircle, XCircle } from "lucide-react";
import { useState, useMemo } from "react";

interface SidebarProps {
  connections: Connection[];
  tools: Record<string, Tool[]>;
  resources: Record<string, Resource[]>;
  onToolSelect: (tool: Tool) => void;
  onResourceSelect?: (resource: Resource) => void;
  selectedTool?: Tool | null;
}

export const Sidebar = ({
  connections,
  tools,
  onToolSelect,
  selectedTool,
}: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const {
    conversations,
    disabledTools,
    updateDisabledTools, // NEW: Use reactive method
    isToolEnabled, // NEW: Use reactive method
  } = useStorage();

  const [toolSearchQuery, setToolSearchQuery] = useState("");

  // Manual URL parsing as backup since useParams seems to be failing
  const urlParts = location.pathname.split("/");
  const connectionsIndex = urlParts.findIndex(part => part === "connections");

  let manualConnectionId = "";
  let manualToolId = "";

  if (connectionsIndex !== -1 && urlParts[connectionsIndex + 1]) {
    manualConnectionId = urlParts[connectionsIndex + 1];

    const toolsIndex = urlParts.findIndex(part => part === "tools");
    if (toolsIndex !== -1 && urlParts[toolsIndex + 1]) {
      manualToolId = urlParts[toolsIndex + 1];
    }
  }

  // Get current connection ID from URL params - use manual parsing as fallback
  const currentConnectionId = params.connectionId || manualConnectionId;
  const currentToolId = params.toolId || manualToolId;

  const handleConnectionClick = (connection: Connection) => {
    // Use the connection's actual ID (nanoid), not array index
    const connectionChats = conversations[connection.id] || [];
    const firstChatId = connectionChats[0]?.id || "new";
    navigate(`/connections/${connection.id}/chat/${firstChatId}`);
  };

  const handleToolClick = (tool: Tool) => {
    onToolSelect(tool);
    // Always navigate to connection-specific tool page when a connection is selected
    if (currentConnectionId) {
      navigate(`/connections/${currentConnectionId}/tools/${tool.id}`);
    }
  };

  // Only show tools when a connection is selected
  const toolsToShow = currentConnectionId
    ? tools[currentConnectionId] || []
    : [];

  // Filter tools based on search query and enabled status
  const filteredTools = useMemo(() => {
    let filtered = toolsToShow;

    if (toolSearchQuery.trim()) {
      const query = toolSearchQuery.toLowerCase();
      filtered = filtered.filter(
        tool =>
          tool.name.toLowerCase().includes(query) ||
          tool.description?.toLowerCase().includes(query) ||
          tool.category?.toLowerCase().includes(query) ||
          tool.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [toolsToShow, toolSearchQuery]);

  // NEW: Tool management functions using reactive storage context
  const toggleTool = async (toolId: string) => {
    if (!currentConnectionId) return;

    const currentDisabled = disabledTools[currentConnectionId] || new Set();
    const newDisabledTools = new Set(currentDisabled);

    if (newDisabledTools.has(toolId)) {
      newDisabledTools.delete(toolId);
      console.log(
        `[Sidebar] Enabling tool ${toolId} for connection ${currentConnectionId}`
      );
    } else {
      newDisabledTools.add(toolId);
      console.log(
        `[Sidebar] Disabling tool ${toolId} for connection ${currentConnectionId}`
      );
    }

    // Use the reactive method that notifies listeners
    await updateDisabledTools(currentConnectionId, newDisabledTools);
  };

  const enableAllTools = async () => {
    if (!currentConnectionId) return;

    console.log(
      `[Sidebar] Enabling all tools for connection ${currentConnectionId}`
    );
    // Use the reactive method with empty Set (all tools enabled)
    await updateDisabledTools(currentConnectionId, new Set());
  };

  const disableAllTools = async () => {
    if (!currentConnectionId) return;

    const allToolIds = new Set(toolsToShow.map(tool => tool.id));
    console.log(
      `[Sidebar] Disabling all ${allToolIds.size} tools for connection ${currentConnectionId}`
    );

    // Use the reactive method with all tool IDs disabled
    await updateDisabledTools(currentConnectionId, allToolIds);
  };

  const toggleSelectedTools = async () => {
    if (!currentConnectionId) return;

    // Toggle all currently filtered/visible tools
    const visibleToolIds = filteredTools.map(tool => tool.id);
    const currentDisabled = disabledTools[currentConnectionId] || new Set();
    const newDisabledTools = new Set(currentDisabled);

    // If any visible tool is enabled, disable all visible tools
    // Otherwise, enable all visible tools
    const hasEnabledTool = visibleToolIds.some(id => !newDisabledTools.has(id));

    if (hasEnabledTool) {
      // Disable all visible tools
      visibleToolIds.forEach(id => newDisabledTools.add(id));
      console.log(
        `[Sidebar] Disabling ${visibleToolIds.length} visible tools for connection ${currentConnectionId}`
      );
    } else {
      // Enable all visible tools
      visibleToolIds.forEach(id => newDisabledTools.delete(id));
      console.log(
        `[Sidebar] Enabling ${visibleToolIds.length} visible tools for connection ${currentConnectionId}`
      );
    }

    // Use the reactive method
    await updateDisabledTools(currentConnectionId, newDisabledTools);
  };

  // Helper function to check if a tool is selected
  const isToolSelected = (tool: Tool): boolean => {
    return currentToolId === tool.id || selectedTool?.id === tool.id;
  };

  // Helper function to truncate text with tooltip
  const TruncatedText = ({
    text,
    maxLength = 40,
    className = "",
  }: {
    text: string;
    maxLength?: number;
    className?: string;
  }) => {
    const isTruncated = text.length > maxLength;
    const displayText = isTruncated ? `${text.slice(0, maxLength)}...` : text;

    return (
      <span className={className} title={isTruncated ? text : undefined}>
        {displayText}
      </span>
    );
  };

  // NEW: Calculate counts reactively using the storage context methods
  const enabledCount = filteredTools.filter(tool =>
    currentConnectionId ? isToolEnabled(currentConnectionId, tool.id) : true
  ).length;
  const totalCount = filteredTools.length;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 transition-colors">
      <div className="flex-1 p-4 overflow-y-auto">
        {/* Connections */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Connections
            </h2>
            <button
              onClick={() => navigate("/connections")}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              Manage
            </button>
          </div>
          <div className="space-y-2">
            {connections.map(conn => (
              <div
                key={conn.id}
                className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                  location.pathname.includes(`/connections/${conn.id}`)
                    ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                    : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
                onClick={() => handleConnectionClick(conn)}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="font-medium text-sm text-gray-900 dark:text-white min-w-0 flex-1">
                      <TruncatedText text={conn.name} maxLength={25} />
                    </div>
                    <div
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ml-2 ${
                        conn.connectionType === "sse"
                          ? "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30"
                          : conn.connectionType === "http"
                            ? "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30"
                            : "text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30"
                      }`}
                      title={`Connection type: ${conn.connectionType?.toUpperCase() || "HTTP"}`}
                    >
                      <span className="uppercase">
                        {conn.connectionType || "HTTP"}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 dark:text-gray-400 break-all">
                    <TruncatedText text={conn.url} maxLength={35} />
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          conn.isConnected ? "bg-green-500" : "bg-red-500"
                        }`}
                      />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {conn.isConnected ? "Connected" : "Disconnected"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tools - Only show when a connection is selected */}
        {currentConnectionId && toolsToShow.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900 dark:text-white">
                Tools ({enabledCount}/{totalCount})
              </h2>
            </div>

            {/* Tool Actions - Always Visible */}
            <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={enableAllTools}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-800/50 transition-colors"
                  title="Enable all tools"
                >
                  <CheckCircle className="w-3 h-3" />
                  Enable All
                </button>
                <button
                  onClick={disableAllTools}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors"
                  title="Disable all tools"
                >
                  <XCircle className="w-3 h-3" />
                  Disable All
                </button>
                {filteredTools.length < toolsToShow.length && (
                  <button
                    onClick={toggleSelectedTools}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors"
                    title="Toggle visible tools"
                  >
                    <MoreHorizontal className="w-3 h-3" />
                    Toggle Visible
                  </button>
                )}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Disabled tools won't be available during chat conversations
              </div>
            </div>

            {/* Search Box */}
            <div className="relative mb-3">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search tools..."
                value={toolSearchQuery}
                onChange={e => setToolSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-10 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
              {toolSearchQuery && (
                <button
                  onClick={() => setToolSearchQuery("")}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>

            {/* Tools List */}
            <div className="space-y-2">
              {filteredTools.length === 0 ? (
                <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
                  {toolSearchQuery.trim()
                    ? "No tools match your search"
                    : "No tools available"}
                </div>
              ) : (
                filteredTools.map((tool, idx) => {
                  const enabled = currentConnectionId
                    ? isToolEnabled(currentConnectionId, tool.id)
                    : true;
                  const selected = isToolSelected(tool);

                  return (
                    <div
                      key={`${tool.id}-${idx}`}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors relative ${
                        selected
                          ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                          : enabled
                            ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                            : "bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 opacity-60"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${
                            selected
                              ? "bg-blue-100 dark:bg-blue-900/40"
                              : enabled
                                ? "bg-orange-100 dark:bg-orange-900/30"
                                : "bg-gray-100 dark:bg-gray-700"
                          }`}
                        >
                          <svg
                            className={`w-4 h-4 ${
                              selected
                                ? "text-blue-600 dark:text-blue-400"
                                : enabled
                                  ? "text-orange-600 dark:text-orange-400"
                                  : "text-gray-400 dark:text-gray-500"
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"
                            />
                          </svg>
                        </div>
                        <div
                          className="flex-1 min-w-0"
                          onClick={() => enabled && handleToolClick(tool)}
                        >
                          <div
                            className={`font-medium text-sm leading-tight break-words ${
                              selected
                                ? "text-blue-900 dark:text-blue-100"
                                : enabled
                                  ? "text-gray-900 dark:text-white"
                                  : "text-gray-500 dark:text-gray-400"
                            }`}
                          >
                            {tool.name}
                            {!enabled && (
                              <span className="ml-2 text-xs font-normal opacity-60">
                                (disabled)
                              </span>
                            )}
                          </div>
                          <div
                            className={`text-xs mt-1 leading-relaxed break-words ${
                              selected
                                ? "text-blue-600 dark:text-blue-300"
                                : enabled
                                  ? "text-gray-500 dark:text-gray-400"
                                  : "text-gray-400 dark:text-gray-500"
                            }`}
                          >
                            {tool.description || "No description"}
                          </div>
                        </div>

                        {/* Toggle button - Now uses reactive method */}
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            toggleTool(tool.id);
                          }}
                          className={`flex-shrink-0 p-1 rounded transition-colors ${
                            enabled
                              ? "text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                              : "text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                          }`}
                          title={enabled ? "Disable tool" : "Enable tool"}
                        >
                          {enabled ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Search results summary */}
            {toolSearchQuery.trim() && (
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
                {filteredTools.length} of {toolsToShow.length} tools shown
              </div>
            )}
          </div>
        )}
      </div>

      {/* RconnectLogo at bottom */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <RconnectLogo className="transition-opacity" />
      </div>
    </div>
  );
};
