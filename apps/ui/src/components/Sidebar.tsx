import { ConnectionItem, ToolItem } from "@mcpconnect/components";
import { Connection, Tool, Resource } from "@mcpconnect/schemas";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { RconnectLogo } from "./RconnectLogo";
import { useStorage } from "../contexts/StorageContext";

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

  // Manual URL parsing as backup since useParams seems to be failing
  const urlParts = location.pathname.split("/");
  const connectionsIndex = urlParts.findIndex(part => part === "connections");

  let manualConnectionId = "";
  let manualChatId = "";
  let manualToolId = "";

  if (connectionsIndex !== -1 && urlParts[connectionsIndex + 1]) {
    manualConnectionId = urlParts[connectionsIndex + 1];

    const chatIndex = urlParts.findIndex(part => part === "chat");
    if (chatIndex !== -1 && urlParts[chatIndex + 1]) {
      manualChatId = urlParts[chatIndex + 1];
    }

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

  // Helper function to check if a tool is selected
  const isToolSelected = (tool: Tool): boolean => {
    return currentToolId === tool.id || selectedTool?.id === tool.id;
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
              <ConnectionItem
                key={conn.id}
                {...conn}
                onClick={() => handleConnectionClick(conn)}
                isActive={location.pathname.includes(`/connections/${conn.id}`)}
              />
            ))}
          </div>
        </div>

        {/* Tools - Only show when a connection is selected */}
        {currentConnectionId && toolsToShow.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900 dark:text-white">
                Tools
              </h2>
            </div>
            <div className="space-y-2">
              {toolsToShow.map((tool, idx) => (
                <ToolItem
                  key={`${tool.id}-${idx}`}
                  {...tool}
                  onClick={() => handleToolClick(tool)}
                  isSelected={isToolSelected(tool)}
                />
              ))}
            </div>
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
