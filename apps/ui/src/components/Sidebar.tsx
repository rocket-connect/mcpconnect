// apps/ui/src/components/Sidebar.tsx - Complete updated version with tool selection highlighting
import { ConnectionItem, ToolItem, ResourceItem } from "@mcpconnect/components";
import { Connection, Tool, Resource } from "@mcpconnect/schemas";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { RconnectLogo } from "./RconnectLogo";
import { MessageSquare } from "lucide-react";
import { useStorage } from "../contexts/StorageContext";

interface SidebarProps {
  connections: Connection[];
  tools: Record<string, Tool[]>;
  resources: Record<string, Resource[]>;
  onToolSelect: (tool: Tool) => void;
  onResourceSelect?: (resource: Resource) => void;
  selectedTool?: Tool | null; // Add selected tool prop
}

export const Sidebar = ({
  connections,
  tools,
  resources,
  onToolSelect,
  onResourceSelect,
  selectedTool, // Accept selected tool prop
}: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { conversations } = useStorage();

  // Get current connection ID from URL params
  const currentConnectionId = params.id;

  const handleConnectionClick = (_connection: Connection, index: number) => {
    // Navigate to connection chat by default - will use first chat
    navigate(`/connections/${index}/chat`);
  };

  const handleChatClick = (connectionIndex: number, chatIndex: number) => {
    navigate(`/connections/${connectionIndex}/chat/${chatIndex}`);
  };

  const handleToolClick = (tool: Tool) => {
    onToolSelect(tool);
    // If we're in a connection context, stay there, otherwise go to global tools
    if (currentConnectionId) {
      navigate(`/connections/${currentConnectionId}/tools`);
    } else {
      navigate("/tools");
    }
  };

  const handleResourceClick = (resource: Resource, index: number) => {
    if (onResourceSelect) {
      onResourceSelect(resource);
    }
    // If we're in a connection context, navigate to that connection's resource
    if (currentConnectionId) {
      navigate(`/connections/${currentConnectionId}/resources/${index}`);
    } else {
      navigate(`/resources/${index}`);
    }
  };

  // Determine which tools and resources to show
  const toolsToShow = currentConnectionId
    ? tools[currentConnectionId] || []
    : [];
  const resourcesToShow = currentConnectionId
    ? resources[currentConnectionId] || []
    : [];
  const chatsToShow = currentConnectionId
    ? conversations[currentConnectionId] || []
    : [];

  // Show all tools if not in connection context
  const allTools = currentConnectionId
    ? toolsToShow
    : Object.values(tools).flat();
  const allResources = currentConnectionId
    ? resourcesToShow
    : Object.values(resources).flat();

  // Helper function to check if a tool is selected
  const isToolSelected = (tool: Tool): boolean => {
    return selectedTool?.name === tool.name;
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 transition-colors">
      <div className="flex-1 p-4 overflow-y-auto">
        {/* Connection Context Header */}
        {currentConnectionId && (
          <div className="mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <div
                className={`w-2 h-2 rounded-full ${connections[parseInt(currentConnectionId)]?.isConnected ? "bg-green-500" : "bg-red-500"}`}
              />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                {connections[parseInt(currentConnectionId)]?.name ||
                  "Connection"}
              </h2>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {connections[parseInt(currentConnectionId)]?.url}
            </p>
            <button
              onClick={() => navigate("/connections")}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors mt-2"
            >
              ← All Connections
            </button>
          </div>
        )}

        {/* Conversations/Chats Section (only show if in connection context) */}
        {currentConnectionId && chatsToShow.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900 dark:text-white">
                Chats ({chatsToShow.length})
              </h2>
            </div>
            <div className="space-y-2">
              {chatsToShow.map((chat, chatIndex) => (
                <button
                  key={chat.id}
                  onClick={() =>
                    handleChatClick(parseInt(currentConnectionId), chatIndex)
                  }
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    location.pathname.includes(`/chat/${chatIndex}`)
                      ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                      : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <MessageSquare className="w-4 h-4 text-blue-500" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                        {chat.title}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {chat.messages.length} messages
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Connections */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              {currentConnectionId ? "Other Connections" : "Connections"}
            </h2>
            <button
              onClick={() => navigate("/connections")}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium transition-colors"
            >
              View All
            </button>
          </div>
          <div className="space-y-2">
            {connections
              .filter((_, idx) =>
                currentConnectionId
                  ? idx.toString() !== currentConnectionId
                  : true
              )
              .slice(0, 3)
              .map(conn => {
                const displayIdx = connections.findIndex(c => c === conn);

                return (
                  <ConnectionItem
                    key={`${conn.name}-${displayIdx}`}
                    {...conn}
                    onClick={() => handleConnectionClick(conn, displayIdx)}
                    isActive={location.pathname.includes(
                      `/connections/${displayIdx}`
                    )}
                  />
                );
              })}
          </div>
        </div>

        {/* Tools */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              {currentConnectionId ? "Connection Tools" : "All Tools"} (
              {allTools.length})
            </h2>
            {currentConnectionId ? (
              <button
                onClick={() =>
                  navigate(`/connections/${currentConnectionId}/tools`)
                }
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium transition-colors"
              >
                View All
              </button>
            ) : (
              <button
                onClick={() => navigate("/tools")}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium transition-colors"
              >
                View All
              </button>
            )}
          </div>
          <div className="space-y-2">
            {allTools.slice(0, 5).map((tool, idx) => (
              <ToolItem
                key={`${tool.name}-${idx}`}
                {...tool}
                onClick={() => handleToolClick(tool)}
                isSelected={isToolSelected(tool)}
              />
            ))}
            {allTools.length > 5 && (
              <button
                onClick={() =>
                  currentConnectionId
                    ? navigate(`/connections/${currentConnectionId}/tools`)
                    : navigate("/tools")
                }
                className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                +{allTools.length - 5} more tools
              </button>
            )}
          </div>
        </div>

        {/* Resources */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              {currentConnectionId ? "Connection Resources" : "All Resources"} (
              {allResources.length})
            </h2>
            {currentConnectionId ? (
              <button
                onClick={() =>
                  navigate(`/connections/${currentConnectionId}/resources`)
                }
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium transition-colors"
              >
                View All
              </button>
            ) : (
              <button
                onClick={() => navigate("/resources")}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium transition-colors"
              >
                View All
              </button>
            )}
          </div>
          <div className="space-y-2">
            {allResources.slice(0, 5).map((resource, idx) => (
              <ResourceItem
                key={`${resource.name}-${idx}`}
                {...resource}
                onClick={() => handleResourceClick(resource, idx)}
              />
            ))}
            {allResources.length > 5 && (
              <button
                onClick={() =>
                  currentConnectionId
                    ? navigate(`/connections/${currentConnectionId}/resources`)
                    : navigate("/resources")
                }
                className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                +{allResources.length - 5} more resources
              </button>
            )}
          </div>
        </div>
      </div>

      {/* RconnectLogo at bottom */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <RconnectLogo className="opacity-90 hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
};
