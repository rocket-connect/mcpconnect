import { Connection, Resource } from "@mcpconnect/schemas";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { RconnectLogo } from "./RconnectLogo";
import { useStorage } from "../contexts/StorageContext";
import { Search, X, MoreHorizontal, CheckCircle, XCircle } from "lucide-react";
import { useState, useMemo } from "react";

interface SidebarProps {
  connections: Connection[];
  resources: Record<string, Resource[]>;
}

export const Sidebar = ({ connections }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const {
    conversations,
    tools,
    disabledTools,
    updateDisabledTools,
    isToolEnabled,
  } = useStorage();

  const [toolSearchQuery, setToolSearchQuery] = useState("");

  // Manual URL parsing as backup since useParams seems to be failing
  const urlParts = location.pathname.split("/");
  const connectionsIndex = urlParts.findIndex(part => part === "connections");

  let manualConnectionId = "";

  if (connectionsIndex !== -1 && urlParts[connectionsIndex + 1]) {
    manualConnectionId = urlParts[connectionsIndex + 1];
  }

  // Get current connection ID from URL params - use manual parsing as fallback
  const currentConnectionId = params.connectionId || manualConnectionId;

  const handleConnectionClick = (connection: Connection) => {
    // Use the connection's actual ID (nanoid), not array index
    const connectionChats = conversations[connection.id] || [];
    const firstChatId = connectionChats[0]?.id || "new";
    navigate(`/connections/${connection.id}/chat/${firstChatId}`);
  };

  // Only show tools when a connection is selected
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const toolsToShow = currentConnectionId
    ? tools[currentConnectionId] || []
    : [];

  // Filter tools based on search query
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

  // Tool management functions using reactive storage context
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

  // Helper function to truncate text with tooltip
  const TruncatedText = ({
    text,
    maxLength = 50,
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

  // Calculate counts reactively using the storage context methods
  const enabledCount = filteredTools.filter(tool =>
    currentConnectionId ? isToolEnabled(currentConnectionId, tool.id) : true
  ).length;
  const totalCount = filteredTools.length;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 transition-colors">
      <div className="flex-1 p-5 overflow-y-auto">
        {/* Connections */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg text-gray-900 dark:text-white">
              Connections
            </h2>
            <button
              onClick={() => navigate("/connections")}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors font-medium"
            >
              Manage
            </button>
          </div>
          <div className="space-y-3">
            {connections.map(conn => (
              <div
                key={conn.id}
                className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-sm ${
                  location.pathname.includes(`/connections/${conn.id}`)
                    ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 shadow-sm"
                    : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
                onClick={() => handleConnectionClick(conn)}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="font-medium text-sm text-gray-900 dark:text-white min-w-0 flex-1 pr-2">
                      <TruncatedText text={conn.name} maxLength={35} />
                    </div>
                    <div
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
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

                  <div className="text-xs text-gray-500 dark:text-gray-400 break-all font-mono bg-gray-50 dark:bg-gray-900 px-2 py-1 rounded">
                    <TruncatedText text={conn.url} maxLength={45} />
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
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg text-gray-900 dark:text-white">
                Tools ({enabledCount}/{totalCount})
              </h2>
            </div>

            {/* Tool Actions - Always Visible */}
            <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  onClick={enableAllTools}
                  className="flex items-center gap-2 px-3 py-2 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-md hover:bg-green-200 dark:hover:bg-green-800/50 transition-colors font-medium"
                  title="Enable all tools"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Enable All
                </button>
                <button
                  onClick={disableAllTools}
                  className="flex items-center gap-2 px-3 py-2 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors font-medium"
                  title="Disable all tools"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Disable All
                </button>
                {filteredTools.length < toolsToShow.length && (
                  <button
                    onClick={toggleSelectedTools}
                    className="flex items-center gap-2 px-3 py-2 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors font-medium"
                    title="Toggle visible tools"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                    Toggle Visible
                  </button>
                )}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Disabled tools won't be available during chat conversations
              </div>
            </div>

            {/* Search Box */}
            <div className="relative mb-4">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search tools..."
                value={toolSearchQuery}
                onChange={e => setToolSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-10 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
              {toolSearchQuery && (
                <button
                  onClick={() => setToolSearchQuery("")}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <X className="h-4 w-4 text-gray-400 hover:text-gray-600 transition-colors" />
                </button>
              )}
            </div>

            {/* Tools List */}
            <div className="space-y-3">
              {filteredTools.length === 0 ? (
                <div className="text-center py-6 text-sm text-gray-500 dark:text-gray-400">
                  {toolSearchQuery.trim()
                    ? "No tools match your search"
                    : "No tools available"}
                </div>
              ) : (
                filteredTools.map((tool, idx) => {
                  const enabled = currentConnectionId
                    ? isToolEnabled(currentConnectionId, tool.id)
                    : true;

                  return (
                    <div
                      key={`${tool.id}-${idx}`}
                      className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 relative ${
                        enabled
                          ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm"
                          : "bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 opacity-60"
                      }`}
                      onClick={() => toggleTool(tool.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                            enabled
                              ? "bg-orange-100 dark:bg-orange-900/30"
                              : "bg-gray-100 dark:bg-gray-700"
                          }`}
                        >
                          <svg
                            className={`w-5 h-5 ${
                              enabled
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
                        <div className="flex-1 min-w-0">
                          <div
                            className={`font-medium text-sm leading-tight break-words mb-1 ${
                              enabled
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
                            className={`text-xs leading-relaxed break-words ${
                              enabled
                                ? "text-gray-500 dark:text-gray-400"
                                : "text-gray-400 dark:text-gray-500"
                            }`}
                          >
                            {tool.description || "No description"}
                          </div>
                        </div>

                        {/* Status indicator */}
                        <div
                          className={`flex-shrink-0 p-1.5 rounded-lg transition-all duration-200 ${
                            enabled
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                          title={enabled ? "Enabled" : "Disabled"}
                        >
                          {enabled ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Search results summary */}
            {toolSearchQuery.trim() && (
              <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 text-center">
                {filteredTools.length} of {toolsToShow.length} tools shown
              </div>
            )}
          </div>
        )}
      </div>

      {/* RconnectLogo at bottom */}
      <div className="p-5 border-t border-gray-200 dark:border-gray-700">
        <RconnectLogo className="transition-opacity" />
      </div>
    </div>
  );
};
