import { useParams, useNavigate, useLocation } from "react-router-dom";
import { NetworkInspector } from "@mcpconnect/components";
import { useStorage } from "./StorageContext";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";

interface InspectorContextType {
  selectedToolCall: string | null;
  expandedToolCall: string | null;
  setSelectedToolCall: (id: string | null) => void;
  setExpandedToolCall: (id: string | null) => void;
  syncToolCallState: (toolCallId: string, isExpanded: boolean) => void;
  refreshManualExecutions: () => Promise<void>;
  manualExecutions: any[];
  manualExecutionsVersion: number;
}

const InspectorContext = createContext<InspectorContextType | undefined>(
  undefined
);

export function useInspector() {
  const context = useContext(InspectorContext);
  if (!context) {
    throw new Error("useInspector must be used within InspectorProvider");
  }
  return context;
}

export function InspectorProvider({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { adapter, tools, systemTools } = useStorage();

  const [selectedToolCall, setSelectedToolCall] = useState<string | null>(null);
  const [expandedToolCall, setExpandedToolCall] = useState<string | null>(null);
  const [manualExecutionsVersion, setManualExecutionsVersion] = useState(0);
  const [manualExecutions, setManualExecutions] = useState<any[]>([]);

  const connectionId = params.connectionId || "";
  const chatId = params.chatId || "";
  const toolId = params.toolId || "";

  const urlParts = location.pathname.split("/");

  let manualConnectionId = "";
  let manualChatId = "";
  let manualToolId = "";

  const connectionsIndex = urlParts.findIndex(part => part === "connections");
  if (connectionsIndex !== -1 && urlParts[connectionsIndex + 1]) {
    manualConnectionId = urlParts[connectionsIndex + 1];

    const chatIndex = urlParts.findIndex(part => part === "chat");
    if (chatIndex !== -1 && urlParts[chatIndex + 1]) {
      manualChatId = urlParts[chatIndex + 1];

      const toolsIndex = urlParts.findIndex(part => part === "tools");
      if (toolsIndex !== -1 && urlParts[toolsIndex + 1]) {
        manualToolId = urlParts[toolsIndex + 1];
      }
    } else {
      const directToolsIndex = urlParts.findIndex(part => part === "tools");
      if (directToolsIndex !== -1 && urlParts[directToolsIndex + 1]) {
        manualToolId = urlParts[directToolsIndex + 1];
      }
    }
  }

  const finalConnectionId = connectionId || manualConnectionId;
  const finalChatId = chatId || manualChatId;
  const finalToolId = toolId || manualToolId;

  const isToolDetailView =
    location.pathname.includes("/tools/") &&
    !location.pathname.includes("/chat/");

  // Helper function to resolve tool ID to tool name
  const getToolNameFromId = useCallback(
    (toolIdOrName: string, connId: string): string => {
      // Check system tools first
      const systemTool = systemTools.find(
        t => t.id === toolIdOrName || t.name === toolIdOrName
      );
      if (systemTool) {
        return systemTool.name;
      }

      // Check connection tools
      const connectionTools = tools[connId] || [];
      const tool = connectionTools.find(
        t => t.id === toolIdOrName || t.name === toolIdOrName
      );

      if (tool) {
        return tool.name;
      }

      return toolIdOrName;
    },
    [systemTools, tools]
  );

  // Load manual executions with proper tool name resolution
  useEffect(() => {
    const isOnToolPage =
      location.pathname.includes("/tools/") &&
      !location.pathname.includes("/chat/");

    if (!isOnToolPage || !finalConnectionId || !finalToolId) {
      if (!isOnToolPage) {
        setManualExecutions([]);
      }
      return;
    }

    let mounted = true;

    const loadManualExecutions = async () => {
      if (!adapter) {
        return;
      }

      try {
        // Resolve the tool ID to its name for storage key consistency
        const toolName = getToolNameFromId(finalToolId, finalConnectionId);

        const stored = await adapter.get(
          `manual-executions-${finalConnectionId}-${toolName}`
        );

        if (stored?.value && Array.isArray(stored.value) && mounted) {
          const uniqueMap = new Map();
          stored.value.forEach((exec: any) => {
            const key = exec.id || `${exec.tool}-${exec.timestamp}`;
            if (!uniqueMap.has(key)) {
              uniqueMap.set(key, exec);
            } else {
              const existing = uniqueMap.get(key);
              if (
                (exec.response && !existing.response) ||
                (exec.result && !existing.result)
              ) {
                uniqueMap.set(key, exec);
              }
            }
          });
          const uniqueExecutions = Array.from(uniqueMap.values());

          uniqueExecutions.sort((a: any, b: any) => {
            const timeA = new Date(a.timestamp || 0).getTime();
            const timeB = new Date(b.timestamp || 0).getTime();
            return timeB - timeA;
          });

          setManualExecutions(uniqueExecutions);

          if (uniqueExecutions.length < stored.value.length) {
            await adapter.set(
              `manual-executions-${finalConnectionId}-${toolName}`,
              uniqueExecutions,
              {
                type: "array",
                tags: ["mcp", "manual-executions", finalConnectionId, toolName],
                compress: true,
                encrypt: false,
              }
            );
          }
        } else if (mounted) {
          setManualExecutions([]);
        }
      } catch (error) {
        console.error(
          "[InspectorProvider] Failed to load manual executions:",
          error
        );
        if (mounted) {
          setManualExecutions([]);
        }
      }
    };

    // Load immediately on mount/change
    loadManualExecutions();

    // Poll for updates every 500ms
    const pollInterval = setInterval(() => {
      loadManualExecutions();
    }, 500);

    return () => {
      mounted = false;
      clearInterval(pollInterval);
    };
  }, [
    adapter,
    finalConnectionId,
    finalToolId,
    location.pathname,
    manualExecutionsVersion,
    getToolNameFromId, // Add dependency
  ]);

  useEffect(() => {
    if (finalToolId) {
      setSelectedToolCall(finalToolId);
      setExpandedToolCall(finalToolId);
    } else {
      setExpandedToolCall(null);
    }
  }, [finalToolId]);

  const syncToolCallState = (toolCallId: string, isExpanded: boolean) => {
    if (isExpanded) {
      setSelectedToolCall(toolCallId);
      setExpandedToolCall(toolCallId);

      if (isToolDetailView && finalConnectionId) {
        // Stay on tool detail view
      } else if (finalConnectionId && finalChatId) {
        navigate(
          `/connections/${finalConnectionId}/chat/${finalChatId}/tools/${toolCallId}`
        );
      }
    } else {
      if (expandedToolCall === toolCallId) {
        setExpandedToolCall(null);

        if (isToolDetailView && finalConnectionId) {
          // Stay on tool detail page
        } else if (finalConnectionId && finalChatId) {
          navigate(`/connections/${finalConnectionId}/chat/${finalChatId}`);
        }
      }
    }
  };

  const refreshManualExecutions = useCallback(async () => {
    setManualExecutionsVersion(prev => prev + 1);

    // Force immediate reload
    if (adapter && finalConnectionId && finalToolId) {
      try {
        const toolName = getToolNameFromId(finalToolId, finalConnectionId);

        const stored = await adapter.get(
          `manual-executions-${finalConnectionId}-${toolName}`
        );

        if (stored?.value && Array.isArray(stored.value)) {
          const uniqueMap = new Map();
          stored.value.forEach((exec: any) => {
            const key = exec.id || `${exec.tool}-${exec.timestamp}`;
            if (!uniqueMap.has(key)) {
              uniqueMap.set(key, exec);
            }
          });
          const uniqueExecutions = Array.from(uniqueMap.values());

          uniqueExecutions.sort((a: any, b: any) => {
            const timeA = new Date(a.timestamp || 0).getTime();
            const timeB = new Date(b.timestamp || 0).getTime();
            return timeB - timeA;
          });

          setManualExecutions(uniqueExecutions);
        }
      } catch (error) {
        console.error("[InspectorProvider] Immediate refresh failed:", error);
      }
    }
  }, [adapter, finalConnectionId, finalToolId, getToolNameFromId]);

  const contextValue: InspectorContextType = {
    selectedToolCall,
    expandedToolCall,
    setSelectedToolCall,
    setExpandedToolCall,
    syncToolCallState,
    refreshManualExecutions,
    manualExecutions,
    manualExecutionsVersion,
  };

  return (
    <InspectorContext.Provider value={contextValue}>
      {children}
    </InspectorContext.Provider>
  );
}

export function InspectorUI() {
  const params = useParams();
  const location = useLocation();
  const {
    connections,
    conversations,
    hideExecution,
    hiddenExecutions,
    getVisibleExecutions,
  } = useStorage();
  const {
    selectedToolCall,
    setSelectedToolCall,
    setExpandedToolCall,
    syncToolCallState,
    manualExecutions,
  } = useInspector();

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

  const connectionId = params.connectionId || manualConnectionId || "";
  const chatId = params.chatId || manualChatId || "";
  const toolId = params.toolId || manualToolId || "";

  const isToolDetailView =
    location.pathname.includes("/tools/") &&
    !location.pathname.includes("/chat/");
  const isChatView = location.pathname.includes("/chat/");

  const chatHasToolCalls = useMemo(() => {
    if (!chatId || !connectionId) return false;

    const connectionConversations = conversations[connectionId] || [];
    const currentChat = connectionConversations.find(
      conv => conv.id === chatId
    );

    if (!currentChat) return false;

    return currentChat.messages.some(
      msg =>
        Boolean(msg.executingTool) ||
        Boolean(msg.toolExecution) ||
        Boolean(msg.isExecuting)
    );
  }, [chatId, connectionId, conversations]);

  const hasAnyConnections = useMemo(
    () => connections.length > 0,
    [connections]
  );

  const currentConnection = useMemo(
    () => connections.find(conn => conn.id === connectionId) || null,
    [connections, connectionId]
  );

  const currentConversations = useMemo(
    () => conversations[connectionId] || [],
    [conversations, connectionId]
  );

  const currentChat = useMemo(() => {
    if (!chatId) return currentConversations[0];
    return currentConversations.find(conv => conv.id === chatId);
  }, [chatId, currentConversations]);

  const currentHiddenExecutions = useMemo(() => {
    return hiddenExecutions[connectionId] || new Set();
  }, [hiddenExecutions, connectionId]);

  const executionsToShow = useMemo(() => {
    if (currentChat && chatId && isChatView) {
      const toolMessages = currentChat.messages
        .filter(
          msg =>
            Boolean(msg.executingTool) ||
            Boolean(msg.toolExecution) ||
            Boolean(msg.isExecuting)
        )
        .sort((a, b) => {
          if (a.messageOrder !== undefined && b.messageOrder !== undefined) {
            return a.messageOrder - b.messageOrder;
          }
          const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return timeA - timeB;
        });

      return toolMessages.map(msg => {
        const toolName =
          msg.executingTool || msg.toolExecution?.toolName || "unknown";
        const messageId = msg.id || Date.now().toString();

        const executionTime = msg.timestamp
          ? new Date(msg.timestamp)
          : new Date();

        let duration = 0;
        if (msg.toolExecution) {
          if (msg.toolExecution.duration !== undefined) {
            duration = msg.toolExecution.duration;
          } else if (msg.toolExecution.startTime && msg.toolExecution.endTime) {
            duration = msg.toolExecution.endTime - msg.toolExecution.startTime;
          } else if (msg.toolExecution.timestamp && msg.timestamp) {
            const startTime = new Date(msg.timestamp).getTime();
            const endTime = new Date(msg.toolExecution.timestamp).getTime();
            duration = Math.max(0, endTime - startTime);
          }
        }

        return {
          id: messageId,
          tool: toolName,
          status: msg.isExecuting
            ? "pending"
            : msg.toolExecution?.status || "success",
          duration: duration,
          timestamp: executionTime.toISOString(),
          request: {
            tool: toolName,
            arguments: msg.metadata?.arguments || {},
            timestamp: executionTime.toISOString(),
          },
          ...(msg.toolExecution?.result
            ? {
                response: {
                  success: true,
                  result: msg.toolExecution.result,
                  timestamp:
                    msg.toolExecution.timestamp || executionTime.toISOString(),
                },
              }
            : {}),
          ...(msg.toolExecution?.error && {
            error: msg.toolExecution.error,
          }),
          context: "chat",
        };
      });
    } else if (isToolDetailView) {
      return manualExecutions.map(exec => ({
        ...exec,
        context: "manual",
      }));
    }

    return getVisibleExecutions(connectionId || "");
  }, [
    currentChat,
    chatId,
    isChatView,
    isToolDetailView,
    manualExecutions,
    connectionId,
    getVisibleExecutions,
  ]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleHideExecution = async (executionId: string) => {
    if (!connectionId) return;

    try {
      await hideExecution(connectionId, executionId);

      if (selectedToolCall === executionId) {
        setSelectedToolCall(null);
      }
    } catch (error) {
      console.error("Failed to hide execution:", error);
    }
  };

  const inspectorProps = useMemo(() => {
    if (isToolDetailView) {
      return {
        executions: executionsToShow,
        connectionId,
        connectionName: currentConnection?.name || "Unknown Connection",
        chatId: "",
        chatTitle: `Tool: ${toolId}`,
        onToolCallClick: (toolCallId: string) => {
          setSelectedToolCall(toolCallId);
          setExpandedToolCall(toolCallId);
        },
        selectedExecution: selectedToolCall,
        hasAnyConnections,
        chatHasToolCalls: false,
        manualExecutions: executionsToShow,
        isManualContext: true,
        hiddenExecutions: currentHiddenExecutions,
        onDeleteExecution: handleHideExecution,
      };
    } else {
      return {
        executions: executionsToShow,
        connectionId,
        connectionName: currentConnection?.name || "Unknown Connection",
        chatId,
        chatTitle: currentChat?.title || "No Chat Selected",
        onToolCallClick: (toolCallId: string) => {
          syncToolCallState(toolCallId, true);
        },
        selectedExecution: selectedToolCall,
        hasAnyConnections,
        chatHasToolCalls,
        manualExecutions: [],
        isManualContext: false,
        hiddenExecutions: currentHiddenExecutions,
        onDeleteExecution: handleHideExecution,
      };
    }
  }, [
    isToolDetailView,
    executionsToShow,
    connectionId,
    currentConnection?.name,
    toolId,
    chatId,
    currentChat?.title,
    selectedToolCall,
    hasAnyConnections,
    chatHasToolCalls,
    currentHiddenExecutions,
    handleHideExecution,
    setSelectedToolCall,
    setExpandedToolCall,
    syncToolCallState,
  ]);

  if (!connectionId) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-800 transition-colors h-full">
        <NetworkInspector
          executions={[]}
          connectionId=""
          connectionName="No connection selected"
          chatId=""
          chatTitle=""
          onToolCallClick={() => {}}
          hasAnyConnections={hasAnyConnections}
          chatHasToolCalls={false}
          hiddenExecutions={new Set()}
          onDeleteExecution={() => {}}
        />
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 transition-colors h-full">
      <NetworkInspector {...inspectorProps} />
    </div>
  );
}
