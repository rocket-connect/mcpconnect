import { Connection, Tool, Resource } from "@mcpconnect/schemas";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { RconnectLogo } from "./RconnectLogo";
import { useStorage } from "../contexts/StorageContext";
import { Search, X } from "lucide-react";
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
  const { conversations } = useStorage();
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const toolsToShow = currentConnectionId
    ? tools[currentConnectionId] || []
    : [];

  // Filter tools based on search query
  const filteredTools = useMemo(() => {
    if (!toolSearchQuery.trim()) {
      return toolsToShow;
    }

    const query = toolSearchQuery.toLowerCase();
    return toolsToShow.filter(
      tool =>
        tool.name.toLowerCase().includes(query) ||
        tool.description?.toLowerCase().includes(query) ||
        tool.category?.toLowerCase().includes(query) ||
        tool.tags?.some(tag => tag.toLowerCase().includes(query))
    );
  }, [toolsToShow, toolSearchQuery]);

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

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 transition-colors">
      <div className="flex-1 p-4 overflow-y-auto">
        {/* Connections */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Connections
            </h2>
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
                Tools ({filteredTools.length})
              </h2>
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
                filteredTools.map((tool, idx) => (
                  <div
                    key={`${tool.id}-${idx}`}
                    onClick={() => handleToolClick(tool)}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      isToolSelected(tool)
                        ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                        : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${
                          isToolSelected(tool)
                            ? "bg-blue-100 dark:bg-blue-900/40"
                            : "bg-orange-100 dark:bg-orange-900/30"
                        }`}
                      >
                        <svg
                          className={`w-4 h-4 ${
                            isToolSelected(tool)
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-orange-600 dark:text-orange-400"
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
                          className={`font-medium text-sm leading-tight break-words ${
                            isToolSelected(tool)
                              ? "text-blue-900 dark:text-blue-100"
                              : "text-gray-900 dark:text-white"
                          }`}
                        >
                          {tool.name}
                        </div>
                        <div
                          className={`text-xs mt-1 leading-relaxed break-words ${
                            isToolSelected(tool)
                              ? "text-blue-600 dark:text-blue-300"
                              : "text-gray-500 dark:text-gray-400"
                          }`}
                        >
                          {tool.description || "No description"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
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
