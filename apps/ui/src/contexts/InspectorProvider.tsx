// apps/ui/src/contexts/InspectorProvider.tsx - Updated for chat ID support
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { NetworkInspector } from "@mcpconnect/components";
import { useStorage } from "./StorageContext";
import mockData from "../data/mockData";
import { createContext, useContext, useState, useEffect } from "react";

// Create context for shared inspector state
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

// Context Provider Component (no UI rendering)
export function InspectorProvider({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Shared state for tool call selection and expansion
  const [selectedToolCall, setSelectedToolCall] = useState<string | null>(null);
  const [expandedToolCall, setExpandedToolCall] = useState<string | null>(null);

  // Extract parameters with proper defaults
  let connectionId: string = params.id || "";
  let chatId: string = params.chatId || "";
  let toolId: string = params.toolId || "";

  // If params are empty, try to extract from pathname
  if (!connectionId && location.pathname.includes("/connections/")) {
    const pathParts = location.pathname.split("/");
    const connectionsIndex = pathParts.indexOf("connections");
    if (connectionsIndex !== -1 && pathParts[connectionsIndex + 1]) {
      connectionId = pathParts[connectionsIndex + 1];

      const chatIndex = pathParts.indexOf("chat");
      if (chatIndex !== -1 && pathParts[chatIndex + 1]) {
        chatId = pathParts[chatIndex + 1];
      }

      const toolsIndex = pathParts.indexOf("tools");
      if (toolsIndex !== -1 && pathParts[toolsIndex + 1]) {
        toolId = pathParts[toolsIndex + 1];
      }
    }
  }

  console.log("=== NETWORK INSPECTOR DEBUG ===");
  console.log("Current URL:", location.pathname);
  console.log("Extracted connectionId:", connectionId);
  console.log("Extracted chatId:", chatId);
  console.log("Extracted toolId:", toolId);

  // Sync expanded state with URL parameters
  useEffect(() => {
    if (toolId) {
      setSelectedToolCall(toolId);
      setExpandedToolCall(toolId);
    } else {
      setExpandedToolCall(null);
    }
  }, [toolId]);

  // Function to sync tool call state between chat and inspector
  const syncToolCallState = (toolCallId: string, isExpanded: boolean) => {
    console.log("syncToolCallState called:", { toolCallId, isExpanded });

    if (isExpanded) {
      setSelectedToolCall(toolCallId);
      setExpandedToolCall(toolCallId);

      // Update URL to include tool call - now using chat ID instead of index
      if (connectionId && chatId) {
        navigate(
          `/connections/${connectionId}/chat/${chatId}/tools/${toolCallId}`
        );
      }
    } else {
      // Collapse tool call
      if (expandedToolCall === toolCallId) {
        setExpandedToolCall(null);

        // Remove tool call from URL - now using chat ID instead of index
        if (connectionId && chatId) {
          navigate(`/connections/${connectionId}/chat/${chatId}`);
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

// UI Component (uses the context)
export function InspectorUI() {
  const params = useParams();
  const location = useLocation();
  const { connections, conversations, toolExecutions } = useStorage();
  const { selectedToolCall, syncToolCallState } = useInspector();

  // Extract parameters with proper defaults
  let connectionId: string = params.id || "";
  let chatId: string = params.chatId || "";

  // If params are empty, try to extract from pathname
  if (!connectionId && location.pathname.includes("/connections/")) {
    const pathParts = location.pathname.split("/");
    const connectionsIndex = pathParts.indexOf("connections");
    if (connectionsIndex !== -1 && pathParts[connectionsIndex + 1]) {
      connectionId = pathParts[connectionsIndex + 1];

      const chatIndex = pathParts.indexOf("chat");
      if (chatIndex !== -1 && pathParts[chatIndex + 1]) {
        chatId = pathParts[chatIndex + 1];
      }
    }
  }

  // Early return if no connection is selected
  if (!connectionId) {
    console.log("No connectionId - showing empty state");
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-800 transition-colors h-full">
        <NetworkInspector
          executions={[]}
          connectionId=""
          connectionName="No connection selected"
          chatId=""
          chatTitle=""
          onToolCallClick={() => {}}
        />
      </div>
    );
  }

  // Parse connection index
  const connectionIndex = parseInt(connectionId);
  if (isNaN(connectionIndex)) {
    console.log("Invalid connectionId - not a number:", connectionId);
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-800 transition-colors h-full">
        <NetworkInspector
          executions={[]}
          connectionId={connectionId}
          connectionName="Invalid connection"
          chatId=""
          chatTitle=""
          onToolCallClick={() => {}}
        />
      </div>
    );
  }

  // Get connection data
  const currentConnection = connections[connectionIndex] || null;
  const currentConversations = conversations[connectionId] || [];
  const connectionExecutions = toolExecutions[connectionId] || [];

  console.log("currentConnection:", currentConnection);
  console.log("currentConversations length:", currentConversations.length);
  console.log("connectionExecutions length:", connectionExecutions.length);

  // Find current chat by ID instead of index
  const currentChat = chatId
    ? currentConversations.find(conv => conv.id === chatId)
    : currentConversations[0];

  console.log("chatId (ID):", chatId);
  console.log(
    "currentChat:",
    currentChat
      ? `${currentChat.title} (${currentChat.messages.length} messages)`
      : "null"
  );

  // Determine which executions to show based on context
  let executionsToShow = connectionExecutions;

  if (currentChat) {
    // For chat ID based filtering, we need to get executions for the specific chat
    const chatSpecificExecutions = mockData.getExecutionsForChat(
      connectionId,
      chatId // Now passing the chat ID instead of index
    );

    console.log("Using chat-specific filtering");
    console.log(
      "Chat tool message IDs:",
      currentChat.messages
        .filter(msg => Boolean(msg.executingTool) || Boolean(msg.toolExecution))
        .map(msg => ({
          id: msg.id,
          tool: msg.executingTool || msg.toolExecution?.toolName,
        }))
    );

    if (chatSpecificExecutions.length > 0) {
      executionsToShow = chatSpecificExecutions;
    }
  }

  console.log("Final executionsToShow:", executionsToShow.length);
  console.log("=== END DEBUG ===");

  // Handle tool call navigation from inspector
  const handleToolCallClick = (toolCallId: string) => {
    console.log("handleToolCallClick called with:", toolCallId);
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
      />
    </div>
  );
}
