// apps/ui/src/components/Sidebar.tsx
import { Connection, Resource } from "@mcpconnect/schemas";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { RconnectLogo } from "./RconnectLogo";
import { useStorage } from "../contexts/StorageContext";
import {
  ConnectionCard,
  ToolCard,
  ToolActionsPanel,
} from "@mcpconnect/components";
import { useState, useMemo, useEffect } from "react";
import { Users, Plus, Search, X, Wrench, Zap } from "lucide-react";

interface SidebarProps {
  connections: Connection[];
  resources: Record<string, Resource[]>;
}

// Demo data for onboarding
const demoConnection = {
  id: "demo-github",
  name: "GitHub MCP Demo",
  url: "https://github-mcp.example.com/api",
  connectionType: "sse" as const,
  isActive: false,
  isConnected: true,
  authType: "bearer" as const,
  credentials: { token: "ghp_demo****" },
  headers: {},
  timeout: 30000,
  retryAttempts: 3,
};

const demoTools = [
  {
    id: "repo_browse",
    name: "repo_browse",
    description: "Browse repository files and directories",
    category: "Development",
    tags: ["github", "repository"],
    deprecated: false,
  },
  {
    id: "list_issues",
    name: "list_issues",
    description: "List issues from a GitHub repository",
    category: "APIs",
    tags: ["github", "issues"],
    deprecated: false,
  },
  {
    id: "create_pr",
    name: "create_pr",
    description: "Create a new pull request",
    category: "Development",
    tags: ["github", "pr"],
    deprecated: false,
  },
];

export const Sidebar = ({ connections }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const {
    conversations,
    tools,
    systemTools,
    disabledTools,
    disabledSystemTools,
    updateDisabledTools,
    updateDisabledSystemTools,
    isToolEnabled,
    isSystemToolEnabled,
    onToolStateChange,
    onSystemToolStateChange,
  } = useStorage();

  const [toolSearchQuery, setToolSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"mcp" | "system">("mcp");

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

  // Tool navigation handler
  const handleToolNavigate = (toolId: string) => {
    if (currentConnectionId) {
      navigate(`/connections/${currentConnectionId}/tools/${toolId}`);
    }
  };

  // Check if this is a first-time user
  const isFirstTime = connections.length === 0;

  // Get tools based on active tab - ONLY show when connection is active
  const mcpToolsToShow = isFirstTime
    ? demoTools
    : currentConnectionId
      ? tools[currentConnectionId] || []
      : [];

  // System tools are only shown when there's an active connection
  const systemToolsToShow = currentConnectionId ? systemTools : [];

  const toolsToShow = activeTab === "mcp" ? mcpToolsToShow : systemToolsToShow;

  // Show tools section only if we have a connection or it's first time
  const showToolsSection = isFirstTime || currentConnectionId;

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
    if (isFirstTime || !currentConnectionId) return;

    if (activeTab === "system") {
      // Handle system tool toggle
      const currentDisabled = disabledSystemTools || new Set();
      const newDisabledTools = new Set(currentDisabled);

      if (newDisabledTools.has(toolId)) {
        newDisabledTools.delete(toolId);
      } else {
        newDisabledTools.add(toolId);
      }

      await updateDisabledSystemTools(newDisabledTools);
    } else {
      // Handle MCP tool toggle
      const currentDisabled = disabledTools[currentConnectionId] || new Set();
      const newDisabledTools = new Set(currentDisabled);

      if (newDisabledTools.has(toolId)) {
        newDisabledTools.delete(toolId);
      } else {
        newDisabledTools.add(toolId);
      }

      await updateDisabledTools(currentConnectionId, newDisabledTools);
    }
  };

  const enableAllTools = async () => {
    if (isFirstTime || !currentConnectionId) return;

    if (activeTab === "system") {
      await updateDisabledSystemTools(new Set());
    } else {
      await updateDisabledTools(currentConnectionId, new Set());
    }
  };

  const disableAllTools = async () => {
    if (isFirstTime || !currentConnectionId) return;

    if (activeTab === "system") {
      const allToolIds = new Set(systemToolsToShow.map(tool => tool.id));
      await updateDisabledSystemTools(allToolIds);
    } else {
      const allToolIds = new Set(mcpToolsToShow.map(tool => tool.id));
      await updateDisabledTools(currentConnectionId, allToolIds);
    }
  };

  const toggleSelectedTools = async () => {
    if (isFirstTime || !currentConnectionId) return;

    const visibleToolIds = filteredTools.map(tool => tool.id);

    if (activeTab === "system") {
      const currentDisabled = disabledSystemTools || new Set();
      const newDisabledTools = new Set(currentDisabled);

      const hasEnabledTool = visibleToolIds.some(
        id => !newDisabledTools.has(id)
      );

      if (hasEnabledTool) {
        visibleToolIds.forEach(id => newDisabledTools.add(id));
      } else {
        visibleToolIds.forEach(id => newDisabledTools.delete(id));
      }

      await updateDisabledSystemTools(newDisabledTools);
    } else {
      const currentDisabled = disabledTools[currentConnectionId] || new Set();
      const newDisabledTools = new Set(currentDisabled);

      const hasEnabledTool = visibleToolIds.some(
        id => !newDisabledTools.has(id)
      );

      if (hasEnabledTool) {
        visibleToolIds.forEach(id => newDisabledTools.add(id));
      } else {
        visibleToolIds.forEach(id => newDisabledTools.delete(id));
      }

      await updateDisabledTools(currentConnectionId, newDisabledTools);
    }
  };

  // Calculate counts reactively using the storage context methods
  const enabledCount = isFirstTime
    ? filteredTools.length
    : activeTab === "system"
      ? filteredTools.filter(tool => isSystemToolEnabled(tool.id)).length
      : currentConnectionId
        ? filteredTools.filter(tool =>
            isToolEnabled(currentConnectionId, tool.id)
          ).length
        : 0;

  const totalCount = filteredTools.length;

  // Reactive tool state - forces re-render when tool enablement changes
  const [, setToolStateVersion] = useState(0);

  // Listen for tool state changes and force re-render
  useEffect(() => {
    if (!currentConnectionId && !isFirstTime) return;

    const cleanups: (() => void)[] = [];

    if (activeTab === "system") {
      const cleanup = onSystemToolStateChange(() => {
        setToolStateVersion(prev => prev + 1);
      });
      cleanups.push(cleanup);
    }

    if (currentConnectionId) {
      const cleanup = onToolStateChange(changedConnectionId => {
        if (changedConnectionId === currentConnectionId) {
          setToolStateVersion(prev => prev + 1);
        }
      });
      cleanups.push(cleanup);
    }

    return () => {
      cleanups.forEach(cleanup => cleanup());
    };
  }, [
    currentConnectionId,
    activeTab,
    onToolStateChange,
    onSystemToolStateChange,
    isFirstTime,
  ]);

  // Auto-switch to MCP tab when connection is selected
  useEffect(() => {
    if (currentConnectionId && !isFirstTime) {
      setActiveTab("mcp");
    }
  }, [currentConnectionId, isFirstTime]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 transition-colors overflow-hidden">
      <div className="flex-1 p-4 overflow-y-auto overflow-x-hidden">
        {/* Demo State for First-time Users */}
        {isFirstTime && (
          <div className="mb-6">
            {/* Call to Action */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Plus className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-white">
                    Connect to MCP Server
                  </h3>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    Create your first connection
                  </p>
                </div>
              </div>

              <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                Below is what your sidebar will look like with a real GitHub MCP
                connection. Connect to your own MCP server to get started!
              </p>
            </div>
          </div>
        )}

        {/* Connections */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-base text-gray-900 dark:text-white">
              Connections
            </h2>
            <button
              onClick={() => navigate("/connections")}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors font-medium flex-shrink-0"
            >
              Manage
            </button>
          </div>

          {isFirstTime ? (
            /* Demo Connection */
            <div className="space-y-2">
              <ConnectionCard
                connection={demoConnection}
                isSelected={false}
                conversationCount={0}
                onClick={() => {}}
                isDemoMode={true}
              />
            </div>
          ) : connections.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg mx-auto mb-3 flex items-center justify-center">
                <Users className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                No connections yet
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {connections.map(conn => (
                <ConnectionCard
                  key={conn.id}
                  connection={conn}
                  isSelected={location.pathname.includes(
                    `/connections/${conn.id}`
                  )}
                  conversationCount={(conversations[conn.id] || []).length}
                  onClick={() => handleConnectionClick(conn)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Tools Section - Only show when connection is active or first time */}
        {showToolsSection && (
          <div className="min-w-0 overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-base text-gray-900 dark:text-white">
                Tools ({enabledCount}/{totalCount})
              </h2>
            </div>

            {/* Tool Type Tabs - Only show if we have both types and a connection */}
            {!isFirstTime &&
              currentConnectionId &&
              (mcpToolsToShow.length > 0 || systemTools.length > 0) && (
                <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 mb-3">
                  <button
                    onClick={() => setActiveTab("mcp")}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors min-w-0 ${
                      activeTab === "mcp"
                        ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    <Zap className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">
                      MCP ({mcpToolsToShow.length})
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab("system")}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors min-w-0 ${
                      activeTab === "system"
                        ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    <Wrench className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">
                      System ({systemTools.length})
                    </span>
                  </button>
                </div>
              )}

            {/* Tool Actions - Compact */}
            {toolsToShow.length > 0 && (
              <ToolActionsPanel
                enabledCount={enabledCount}
                totalCount={totalCount}
                filteredCount={filteredTools.length}
                onEnableAll={enableAllTools}
                onDisableAll={disableAllTools}
                onToggleFiltered={toggleSelectedTools}
                isDemoMode={isFirstTime}
              />
            )}

            {/* Search Box - Compact */}
            {toolsToShow.length > 0 && (
              <div
                className={`relative mb-3 ${isFirstTime ? "opacity-60" : ""}`}
              >
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                  <Search className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                </div>
                <input
                  type="text"
                  placeholder={`Search ${activeTab === "system" ? "system" : "MCP"} tools...`}
                  value={toolSearchQuery}
                  onChange={e => setToolSearchQuery(e.target.value)}
                  disabled={isFirstTime}
                  className="block w-full pl-8 pr-8 py-2 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed min-w-0"
                />
                {toolSearchQuery && (
                  <button
                    onClick={() => setToolSearchQuery("")}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center"
                  >
                    <X className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0" />
                  </button>
                )}
              </div>
            )}

            {/* Tools List - Updated with new ToolCard */}
            <div
              className={`space-y-3 ${isFirstTime ? "opacity-60" : ""} min-w-0 overflow-hidden`}
            >
              {filteredTools.length === 0 ? (
                <div className="text-center py-4 text-xs text-gray-500 dark:text-gray-400">
                  {toolSearchQuery.trim()
                    ? `No ${activeTab} tools match your search`
                    : toolsToShow.length === 0
                      ? currentConnectionId
                        ? `No ${activeTab} tools available`
                        : "Select a connection to view tools"
                      : "No tools to display"}
                </div>
              ) : (
                filteredTools.map((tool, idx) => {
                  let enabled: boolean;

                  if (isFirstTime) {
                    enabled = true;
                  } else if (activeTab === "system") {
                    enabled = isSystemToolEnabled(tool.id);
                  } else {
                    enabled = currentConnectionId
                      ? isToolEnabled(currentConnectionId, tool.id)
                      : true;
                  }

                  return (
                    <ToolCard
                      key={`${tool.id}-${idx}`}
                      tool={tool}
                      enabled={enabled}
                      onToggle={() => toggleTool(tool.id)}
                      onNavigate={handleToolNavigate}
                      connectionId={currentConnectionId}
                      isDemoMode={isFirstTime}
                    />
                  );
                })
              )}
            </div>

            {/* Search results summary */}
            {toolSearchQuery.trim() && (
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
                {filteredTools.length} of {toolsToShow.length} {activeTab} tools
              </div>
            )}
          </div>
        )}

        {/* Message when no connection selected and no first time */}
        {!showToolsSection && !isFirstTime && (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg mx-auto mb-4 flex items-center justify-center">
              <Zap className="w-6 h-6 text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Select a Connection
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Choose a connection to view and manage its tools
            </p>
          </div>
        )}
      </div>

      {/* RconnectLogo at bottom */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
        <RconnectLogo className="transition-opacity" />
      </div>
    </div>
  );
};
