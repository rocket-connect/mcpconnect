import { useParams, useNavigate, useLocation } from "react-router-dom";
import { NetworkInspector } from "@mcpconnect/components";
import { useStorage } from "./StorageContext";
import { createContext, useContext, useState, useEffect } from "react";

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
    }
  }

  const finalConnectionId = connectionId || manualConnectionId;
  const finalChatId = chatId || manualChatId;
  const finalToolId = toolId || manualToolId;

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

      if (finalConnectionId && finalChatId) {
        navigate(
          `/connections/${finalConnectionId}/chat/${finalChatId}/tools/${toolCallId}`
        );
      }
    } else {
      if (expandedToolCall === toolCallId) {
        setExpandedToolCall(null);

        if (finalConnectionId && finalChatId) {
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
  const { connections, conversations, toolExecutions } = useStorage();
  const { selectedToolCall, syncToolCallState } = useInspector();

  const urlParts = location.pathname.split("/");
  const connectionsIndex = urlParts.findIndex(part => part === "connections");
  let manualConnectionId = "";
  let manualChatId = "";

  if (connectionsIndex !== -1 && urlParts[connectionsIndex + 1]) {
    manualConnectionId = urlParts[connectionsIndex + 1];
    const chatIndex = urlParts.findIndex(part => part === "chat");
    if (chatIndex !== -1 && urlParts[chatIndex + 1]) {
      manualChatId = urlParts[chatIndex + 1];
    }
  }

  const connectionId = params.connectionId || manualConnectionId || "";
  const chatId = params.chatId || manualChatId || "";

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

  if (currentChat && chatId) {
    const toolMessageIds = currentChat.messages
      .filter(msg => Boolean(msg.executingTool) || Boolean(msg.toolExecution))
      .map(msg => msg.id)
      .filter(Boolean) as string[];

    const chatSpecificExecutions = connectionExecutions.filter(execution =>
      toolMessageIds.includes(execution.id)
    );

    executionsToShow = chatSpecificExecutions;
  }

  const handleToolCallClick = (toolCallId: string) => {
    syncToolCallState(toolCallId, true);
  };

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 transition-colors h-full">
      <NetworkInspector
        executions={executionsToShow}
        connectionId={connectionId}
        connectionName={currentConnection?.name || "Unknown Connection"}
        chatId={chatId}
        chatTitle={currentChat?.title || "No Chat Selected"}
        onToolCallClick={handleToolCallClick}
        selectedExecution={selectedToolCall}
        hasAnyConnections={hasAnyConnections}
        chatHasToolCalls={currentChatHasToolCalls}
      />
    </div>
  );
}
