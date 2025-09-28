/* eslint-disable react-hooks/exhaustive-deps */
// apps/ui/src/contexts/InspectorProvider.tsx
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { NetworkInspector } from "@mcpconnect/components";
import { useStorage } from "./StorageContext";
import { createContext, useContext, useState, useEffect, useMemo } from "react";

interface InspectorContextType {
  selectedToolCall: string | null;
  expandedToolCall: string | null;
  setSelectedToolCall: (id: string | null) => void;
  setExpandedToolCall: (id: string | null) => void;
  syncToolCallState: (toolCallId: string, isExpanded: boolean) => void;
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

  const [selectedToolCall, setSelectedToolCall] = useState<string | null>(null);
  const [expandedToolCall, setExpandedToolCall] = useState<string | null>(null);

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
      // Check for direct tool path (/connections/:id/tools/:toolId)
      const directToolsIndex = urlParts.findIndex(part => part === "tools");
      if (directToolsIndex !== -1 && urlParts[directToolsIndex + 1]) {
        manualToolId = urlParts[directToolsIndex + 1];
      }
    }
  }

  const finalConnectionId = connectionId || manualConnectionId;
  const finalChatId = chatId || manualChatId;
  const finalToolId = toolId || manualToolId;

  // Determine the current view type
  const isToolDetailView =
    location.pathname.includes("/tools/") &&
    !location.pathname.includes("/chat/");

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

      // Different navigation based on current view
      if (isToolDetailView && finalConnectionId) {
        // Stay on tool detail view - just update selection
        // Don't navigate, just expand in place
      } else if (finalConnectionId && finalChatId) {
        // Navigate to chat with tool expanded
        navigate(
          `/connections/${finalConnectionId}/chat/${finalChatId}/tools/${toolCallId}`
        );
      }
    } else {
      if (expandedToolCall === toolCallId) {
        setExpandedToolCall(null);

        // Different navigation based on current view
        if (isToolDetailView && finalConnectionId) {
          // Stay on tool detail page when collapsing - don't navigate away
          // Just collapse the selection
        } else if (finalConnectionId && finalChatId) {
          // Just remove the tool from chat URL
          navigate(`/connections/${finalConnectionId}/chat/${finalChatId}`);
        }
      }
    }
  };

  const contextValue: InspectorContextType = {
    selectedToolCall,
    expandedToolCall,
    setSelectedToolCall,
    setExpandedToolCall,
    syncToolCallState,
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
  const { connections, conversations, toolExecutions, adapter } = useStorage();
  const {
    selectedToolCall,
    setSelectedToolCall,
    setExpandedToolCall,
    syncToolCallState,
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

  // Determine view type
  const isToolDetailView =
    location.pathname.includes("/tools/") &&
    !location.pathname.includes("/chat/");
  const isChatView = location.pathname.includes("/chat/");

  // Load manual executions for tool detail view
  const [manualExecutions, setManualExecutions] = useState<any[]>([]);

  useEffect(() => {
    if (isToolDetailView && connectionId && toolId) {
      const loadManualExecutions = async () => {
        try {
          const stored = await adapter.get(
            `manual-executions-${connectionId}-${toolId}`
          );
          if (stored?.value && Array.isArray(stored.value)) {
            setManualExecutions(stored.value);
          } else {
            setManualExecutions([]);
          }
        } catch (error) {
          console.error("Failed to load manual executions:", error);
          setManualExecutions([]);
        }
      };
      loadManualExecutions();
    } else {
      setManualExecutions([]);
    }
  }, [adapter, connectionId, toolId, isToolDetailView]);

  const chatHasToolCalls = (chatId: string, connectionId: string): boolean => {
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
  };

  const hasAnyConnections = connections.length > 0;
  const currentChatHasToolCalls = chatHasToolCalls(chatId, connectionId);

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
        />
      </div>
    );
  }

  // Get connection data by ID (not index)
  const currentConnection =
    connections.find(conn => conn.id === connectionId) || null;
  const currentConversations = conversations[connectionId] || [];
  const connectionExecutions = toolExecutions[connectionId] || [];

  const currentChat = chatId
    ? currentConversations.find(conv => conv.id === chatId)
    : currentConversations[0];

  let executionsToShow = connectionExecutions;

  if (currentChat && chatId && isChatView) {
    // ENHANCED: Extract tool executions from chat messages with proper ordering
    const toolMessages = currentChat.messages
      .filter(
        msg =>
          Boolean(msg.executingTool) ||
          Boolean(msg.toolExecution) ||
          Boolean(msg.isExecuting)
      )
      .sort((a, b) => {
        // Sort by messageOrder if available, otherwise by timestamp
        if (a.messageOrder !== undefined && b.messageOrder !== undefined) {
          return a.messageOrder - b.messageOrder;
        }
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeA - timeB;
      });

    // Convert chat messages to tool executions for inspector - CHAT CONTEXT ONLY
    const chatBasedExecutions = toolMessages.map(msg => {
      const toolName =
        msg.executingTool || msg.toolExecution?.toolName || "unknown";
      const messageId = msg.id || Date.now().toString();

      return {
        id: messageId,
        tool: toolName,
        status: msg.isExecuting
          ? "pending"
          : msg.toolExecution?.status || "success",
        duration: 0,
        timestamp: msg.timestamp
          ? new Date(msg.timestamp).toLocaleTimeString()
          : new Date().toLocaleTimeString(),
        request: {
          tool: toolName,
          arguments: msg.metadata?.arguments || {},
          timestamp: msg.timestamp
            ? new Date(msg.timestamp).toISOString()
            : new Date().toISOString(),
        },
        ...(msg.toolExecution?.result
          ? {
              response: {
                success: true,
                result: msg.toolExecution.result,
                timestamp: msg.timestamp
                  ? new Date(msg.timestamp).toISOString()
                  : new Date().toISOString(),
              },
            }
          : {}),
        ...(msg.toolExecution?.error && {
          error: msg.toolExecution.error,
        }),
        // Mark as chat execution
        context: "chat",
      };
    });

    // For chat view: ONLY show chat-based executions
    // @ts-ignore
    executionsToShow = chatBasedExecutions;
  } else if (isToolDetailView) {
    // For tool detail view: ONLY show manual executions for this specific tool
    executionsToShow = manualExecutions.map(exec => ({
      ...exec,
      context: "manual",
    }));
  }

  const handleToolCallClick = (toolCallId: string) => {
    // For tool detail view, just update the selection without navigation
    if (isToolDetailView) {
      setSelectedToolCall(toolCallId);
      setExpandedToolCall(toolCallId);
    } else {
      // For chat view, use normal navigation
      syncToolCallState(toolCallId, true);
    }
  };

  // Prepare props for NetworkInspector based on view type
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const inspectorProps = useMemo(() => {
    if (isToolDetailView) {
      return {
        executions: executionsToShow, // Only manual executions for this tool
        connectionId,
        connectionName: currentConnection?.name || "Unknown Connection",
        chatId: "",
        chatTitle: `Tool: ${toolId}`,
        onToolCallClick: handleToolCallClick,
        selectedExecution: selectedToolCall,
        hasAnyConnections,
        chatHasToolCalls: false,
        manualExecutions: executionsToShow, // Same as executions for manual context
        isManualContext: true,
      };
    } else {
      return {
        executions: executionsToShow, // Only chat executions
        connectionId,
        connectionName: currentConnection?.name || "Unknown Connection",
        chatId,
        chatTitle: currentChat?.title || "No Chat Selected",
        onToolCallClick: handleToolCallClick,
        selectedExecution: selectedToolCall,
        hasAnyConnections,
        chatHasToolCalls: currentChatHasToolCalls,
        manualExecutions: [], // No manual executions in chat context
        isManualContext: false,
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
    currentChatHasToolCalls,
    handleToolCallClick,
  ]);

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 transition-colors h-full">
      <NetworkInspector {...inspectorProps} />
    </div>
  );
}
