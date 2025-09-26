// apps/ui/src/contexts/StorageContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { LocalStorageAdapter } from "@mcpconnect/adapter-localstorage";
import {
  Connection,
  Tool,
  Resource,
  ToolExecution,
  ChatConversation,
} from "@mcpconnect/schemas";
import { ModelService } from "../services/modelService";
import { ChatService } from "../services/chatService";
import { SystemToolsService } from "@mcpconnect/adapter-ai-sdk";

interface StorageContextType {
  adapter: LocalStorageAdapter;
  connections: Connection[];
  tools: Record<string, Tool[]>; // MCP tools by connection
  systemTools: Tool[]; // Built-in system tools
  resources: Record<string, Resource[]>;
  conversations: Record<string, ChatConversation[]>;
  toolExecutions: Record<string, ToolExecution[]>;
  disabledTools: Record<string, Set<string>>; // connectionId -> Set of disabled tool IDs
  disabledSystemTools: Set<string>; // disabled system tool IDs
  isLoading: boolean;
  error: string | null;
  updateConnections: (connections: Connection[]) => Promise<void>;
  updateConversations: (
    conversations: Record<string, ChatConversation[]>
  ) => Promise<void>;
  refreshConversations: () => Promise<void>;
  refreshAll: () => Promise<void>;
  forceRefresh: () => Promise<void>;
  addConnection: (connection: Connection) => Promise<void>;
  updateConnection: (connection: Connection) => Promise<void>;
  deleteConnection: (connectionId: string) => Promise<void>;
  getEnabledTools: (connectionId: string) => Tool[];
  getEnabledSystemTools: () => Tool[];
  getAllEnabledTools: (connectionId?: string) => Tool[]; // Combined MCP + system tools
  updateDisabledTools: (
    connectionId: string,
    disabledToolIds: Set<string>
  ) => Promise<void>;
  updateDisabledSystemTools: (disabledToolIds: Set<string>) => Promise<void>;
  isToolEnabled: (connectionId: string, toolId: string) => boolean;
  isSystemToolEnabled: (toolId: string) => boolean;
  onToolStateChange: (callback: (connectionId: string) => void) => () => void;
  onSystemToolStateChange: (callback: () => void) => () => void;
  refreshToolState: (connectionId: string) => Promise<void>;
  refreshSystemToolState: () => Promise<void>;
  deleteChatWithCleanup: (
    connectionId: string,
    chatId: string
  ) => Promise<void>;
  clearAllChatsWithCleanup: (connectionId: string) => Promise<void>;
}

const StorageContext = createContext<StorageContextType | undefined>(undefined);

export function StorageProvider({ children }: { children: React.ReactNode }) {
  const [adapter] = useState(
    () =>
      new LocalStorageAdapter({
        name: "mcpconnect-storage",
        provider: "localstorage",
        prefix: "mcpconnect:",
        debug: false,
        timeout: 30000,
        retries: 3,
        compression: false,
        encryption: false,
        autoCleanup: true,
        cleanupInterval: 3600000,
        maxSize: 10 * 1024 * 1024,
        maxItemSize: 5 * 1024 * 1024,
        simulateAsync: false,
      })
  );

  // Initialize with empty state
  const [connections, setConnections] = useState<Connection[]>([]);
  const [tools, setTools] = useState<Record<string, Tool[]>>({});
  const [systemTools, setSystemTools] = useState<Tool[]>([]);
  const [resources, setResources] = useState<Record<string, Resource[]>>({});
  const [conversations, setConversations] = useState<
    Record<string, ChatConversation[]>
  >({});
  const [toolExecutions, setToolExecutions] = useState<
    Record<string, ToolExecution[]>
  >({});
  const [disabledTools, setDisabledTools] = useState<
    Record<string, Set<string>>
  >({});
  const [disabledSystemTools, setDisabledSystemTools] = useState<Set<string>>(
    new Set()
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tool state change listeners
  const [toolStateListeners, setToolStateListeners] = useState<
    Set<(connectionId: string) => void>
  >(new Set());

  const [systemToolStateListeners, setSystemToolStateListeners] = useState<
    Set<() => void>
  >(new Set());

  // Notify listeners when tool state changes
  const notifyToolStateChange = useCallback(
    (connectionId: string) => {
      toolStateListeners.forEach(listener => {
        try {
          listener(connectionId);
        } catch (error) {
          console.error("Error in tool state listener:", error);
        }
      });
    },
    [toolStateListeners]
  );

  const notifySystemToolStateChange = useCallback(() => {
    systemToolStateListeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error("Error in system tool state listener:", error);
      }
    });
  }, [systemToolStateListeners]);

  // Add tool state change listener
  const onToolStateChange = useCallback(
    (callback: (connectionId: string) => void) => {
      setToolStateListeners(prev => new Set(prev).add(callback));

      // Return cleanup function
      return () => {
        setToolStateListeners(prev => {
          const newSet = new Set(prev);
          newSet.delete(callback);
          return newSet;
        });
      };
    },
    []
  );

  // Add system tool state change listener
  const onSystemToolStateChange = useCallback((callback: () => void) => {
    setSystemToolStateListeners(prev => new Set(prev).add(callback));

    // Return cleanup function
    return () => {
      setSystemToolStateListeners(prev => {
        const newSet = new Set(prev);
        newSet.delete(callback);
        return newSet;
      });
    };
  }, []);

  // Load disabled tools for a specific connection
  const loadDisabledTools = useCallback(
    async (connectionId: string): Promise<Set<string>> => {
      try {
        const stored = await adapter.get(`disabled-tools-${connectionId}`);
        if (stored?.value && Array.isArray(stored.value)) {
          return new Set(stored.value);
        }
      } catch (error) {
        console.error(
          `Failed to load disabled tools for ${connectionId}:`,
          error
        );
      }
      return new Set();
    },
    [adapter]
  );

  // Load disabled system tools
  const loadDisabledSystemTools = useCallback(async (): Promise<
    Set<string>
  > => {
    try {
      const stored = await adapter.get("disabled-system-tools");
      if (stored?.value && Array.isArray(stored.value)) {
        return new Set(stored.value);
      }
    } catch (error) {
      console.error("Failed to load disabled system tools:", error);
    }
    return new Set();
  }, [adapter]);

  // Refresh tool state for specific connection
  const refreshToolState = useCallback(
    async (connectionId: string) => {
      try {
        const newDisabledTools = await loadDisabledTools(connectionId);

        setDisabledTools(prev => ({
          ...prev,
          [connectionId]: newDisabledTools,
        }));

        // Notify listeners that tool state changed
        notifyToolStateChange(connectionId);
      } catch (error) {
        console.error(
          `Failed to refresh tool state for ${connectionId}:`,
          error
        );
      }
    },
    [loadDisabledTools, notifyToolStateChange]
  );

  // Refresh system tool state
  const refreshSystemToolState = useCallback(async () => {
    try {
      const newDisabledSystemTools = await loadDisabledSystemTools();
      setDisabledSystemTools(newDisabledSystemTools);
      notifySystemToolStateChange();
    } catch (error) {
      console.error("Failed to refresh system tool state:", error);
    }
  }, [loadDisabledSystemTools, notifySystemToolStateChange]);

  // Load disabled tools for all connections
  const loadAllDisabledTools = useCallback(async () => {
    const newDisabledTools: Record<string, Set<string>> = {};

    for (const connection of connections) {
      newDisabledTools[connection.id] = await loadDisabledTools(connection.id);
    }

    setDisabledTools(newDisabledTools);

    // Also load disabled system tools
    const newDisabledSystemTools = await loadDisabledSystemTools();
    setDisabledSystemTools(newDisabledSystemTools);
  }, [connections, loadDisabledTools, loadDisabledSystemTools]);

  const getToolExecutionIdsFromChat = useCallback(
    (chat: ChatConversation): string[] => {
      const toolExecutionIds: string[] = [];

      chat.messages.forEach(msg => {
        if (msg.executingTool || msg.toolExecution || msg.isExecuting) {
          if (msg.id) {
            toolExecutionIds.push(msg.id);
          }
        }

        // Also include any explicitly referenced tool execution IDs
        if (msg.toolExecution?.toolName && msg.id) {
          toolExecutionIds.push(msg.id);
        }
      });

      // Remove duplicates
      return [...new Set(toolExecutionIds)];
    },
    []
  );

  const removeToolExecutionsByIds = useCallback(
    async (connectionId: string, executionIds: string[]): Promise<void> => {
      if (executionIds.length === 0) return;

      try {
        const currentExecutions = toolExecutions[connectionId] || [];

        // Filter out tool executions that match any of the execution IDs
        const filteredExecutions = currentExecutions.filter(
          execution => !executionIds.includes(execution.id)
        );

        // Update adapter storage
        await adapter.set(
          `toolExecutions-${connectionId}`,
          filteredExecutions,
          {
            type: "array",
            tags: ["mcp", "toolExecutions", connectionId],
            compress: true,
            encrypt: false,
          }
        );

        setToolExecutions(prev => ({
          ...prev,
          [connectionId]: filteredExecutions,
        }));
      } catch (error) {
        console.error("Failed to remove tool executions:", error);
        throw error;
      }
    },
    [adapter, toolExecutions]
  );

  const deleteChatWithCleanup = useCallback(
    async (connectionId: string, chatId: string): Promise<void> => {
      try {
        const connectionConversations = conversations[connectionId] || [];
        const chatToDelete = connectionConversations.find(
          conv => conv.id === chatId
        );

        if (!chatToDelete) {
          console.warn(
            `[StorageContext] Chat ${chatId} not found for deletion`
          );
          return;
        }

        const toolExecutionIds = getToolExecutionIdsFromChat(chatToDelete);

        const updatedConnectionConversations = connectionConversations.filter(
          conv => conv.id !== chatId
        );
        const updatedConversations = {
          ...conversations,
          [connectionId]: updatedConnectionConversations,
        };

        await adapter.set("conversations", updatedConversations, {
          type: "object",
          tags: ["mcp", "conversations"],
          compress: true,
          encrypt: false,
        });
        setConversations(updatedConversations);

        if (toolExecutionIds.length > 0) {
          await removeToolExecutionsByIds(connectionId, toolExecutionIds);
        }
      } catch (error) {
        console.error("Failed to delete chat with cleanup:", error);
        setError(error instanceof Error ? error.message : String(error));
        throw error;
      }
    },
    [
      adapter,
      conversations,
      getToolExecutionIdsFromChat,
      removeToolExecutionsByIds,
    ]
  );

  const clearAllChatsWithCleanup = useCallback(
    async (connectionId: string): Promise<void> => {
      try {
        const connectionConversations = conversations[connectionId] || [];

        const allToolExecutionIds = connectionConversations.flatMap(chat =>
          getToolExecutionIdsFromChat(chat)
        );

        const updatedConversations = {
          ...conversations,
          [connectionId]: [],
        };

        await adapter.set("conversations", updatedConversations, {
          type: "object",
          tags: ["mcp", "conversations"],
          compress: true,
          encrypt: false,
        });
        setConversations(updatedConversations);

        // Remove all associated tool executions for this connection
        if (allToolExecutionIds.length > 0) {
          await removeToolExecutionsByIds(connectionId, allToolExecutionIds);
        }

        await adapter.delete(`toolExecutions-${connectionId}`);
        setToolExecutions(prev => ({
          ...prev,
          [connectionId]: [],
        }));
      } catch (error) {
        console.error("Failed to clear all chats with cleanup:", error);
        setError(error instanceof Error ? error.message : String(error));
        throw error;
      }
    },
    [
      adapter,
      conversations,
      getToolExecutionIdsFromChat,
      removeToolExecutionsByIds,
    ]
  );

  const refreshAll = useCallback(async () => {
    try {
      const [
        storedConnections,
        storedTools,
        storedResources,
        storedConversations,
        storedExecutions,
      ] = await Promise.all([
        adapter.getConnections(), // Use enhanced method
        adapter.get("tools"),
        adapter.get("resources"),
        adapter.get("conversations"),
        adapter.get("toolExecutions"),
      ]);

      setConnections(storedConnections);

      if (storedTools?.value) {
        const toolsData = storedTools.value as Record<string, Tool[]>;
        setTools(toolsData);
      } else {
        setTools({});
      }

      if (storedResources?.value) {
        const resourcesData = storedResources.value as Record<
          string,
          Resource[]
        >;
        setResources(resourcesData);
      } else {
        setResources({});
      }

      if (storedConversations?.value) {
        const conversationsData = storedConversations.value as Record<
          string,
          ChatConversation[]
        >;
        setConversations(conversationsData);
      }

      if (storedExecutions?.value) {
        const executionsData = storedExecutions.value as Record<
          string,
          ToolExecution[]
        >;
        setToolExecutions(executionsData);
      }

      // Load system tools
      setSystemTools(SystemToolsService.getSystemTools());

      // Load disabled tools after connections are loaded
      await loadAllDisabledTools();
    } catch (err) {
      console.error("Failed to refresh data:", err);
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [adapter, loadAllDisabledTools]);

  const forceRefresh = useCallback(async () => {
    setConnections([]);
    setTools({});
    setSystemTools([]);
    setResources({});
    setConversations({});
    setToolExecutions({});
    setDisabledTools({});
    setDisabledSystemTools(new Set());

    await refreshAll();
  }, [refreshAll]);

  const updateConnections = useCallback(
    async (newConnections: Connection[]) => {
      try {
        await adapter.setConnections(newConnections); // Use enhanced method
        setConnections(newConnections);

        // Reload disabled tools for the updated connections
        await loadAllDisabledTools();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [adapter, loadAllDisabledTools]
  );

  const updateConversations = useCallback(
    async (newConversations: Record<string, ChatConversation[]>) => {
      try {
        await adapter.set("conversations", newConversations, {
          type: "object",
          tags: ["mcp", "conversations"],
          compress: true,
          encrypt: false,
        });
        setConversations(newConversations);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [adapter]
  );

  const refreshConversations = useCallback(async () => {
    try {
      const stored = await adapter.get("conversations");
      if (stored?.value) {
        const conversationsData = stored.value as Record<
          string,
          ChatConversation[]
        >;
        setConversations(conversationsData);
      }
    } catch (err) {
      console.error("Failed to refresh conversations:", err);
    }
  }, [adapter]);

  const addConnection = useCallback(
    async (connection: Connection) => {
      const newConnections = [...connections, connection];
      await updateConnections(newConnections);
    },
    [connections, updateConnections]
  );

  const updateConnection = useCallback(
    async (updatedConnection: Connection) => {
      const newConnections = connections.map(conn =>
        conn.id === updatedConnection.id ? updatedConnection : conn
      );
      await updateConnections(newConnections);
    },
    [connections, updateConnections]
  );

  const deleteConnection = useCallback(
    async (connectionId: string) => {
      try {
        // Remove connection
        const newConnections = connections.filter(
          conn => conn.id !== connectionId
        );
        await updateConnections(newConnections);

        // Remove associated data using adapter's optimized method
        await adapter.removeConnectionData(connectionId);

        // Remove disabled tools data
        await adapter.delete(`disabled-tools-${connectionId}`);

        // Update local state
        const newConversations = { ...conversations };
        delete newConversations[connectionId];
        setConversations(newConversations);

        const newTools = { ...tools };
        delete newTools[connectionId];
        setTools(newTools);

        const newResources = { ...resources };
        delete newResources[connectionId];
        setResources(newResources);

        const newToolExecutions = { ...toolExecutions };
        delete newToolExecutions[connectionId];
        setToolExecutions(newToolExecutions);

        const newDisabledTools = { ...disabledTools };
        delete newDisabledTools[connectionId];
        setDisabledTools(newDisabledTools);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [
      connections,
      conversations,
      tools,
      resources,
      toolExecutions,
      disabledTools,
      adapter,
      updateConnections,
    ]
  );

  // Tool management methods with reactivity
  const updateDisabledTools = useCallback(
    async (connectionId: string, disabledToolIds: Set<string>) => {
      try {
        await adapter.set(
          `disabled-tools-${connectionId}`,
          Array.from(disabledToolIds)
        );

        // Update local state immediately
        setDisabledTools(prev => ({
          ...prev,
          [connectionId]: disabledToolIds,
        }));

        // Notify all listeners that tool state changed
        notifyToolStateChange(connectionId);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [adapter, notifyToolStateChange]
  );

  // System tool management
  const updateDisabledSystemTools = useCallback(
    async (disabledToolIds: Set<string>) => {
      try {
        await adapter.set("disabled-system-tools", Array.from(disabledToolIds));

        // Update local state immediately
        setDisabledSystemTools(disabledToolIds);

        // Notify all listeners that system tool state changed
        notifySystemToolStateChange();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [adapter, notifySystemToolStateChange]
  );

  // Always get fresh tool state
  const getEnabledTools = useCallback(
    (connectionId: string): Tool[] => {
      const allTools = tools[connectionId] || [];
      const disabled = disabledTools[connectionId] || new Set();

      return allTools.filter(tool => !disabled.has(tool.id));
    },
    [tools, disabledTools] // This will cause re-computation when disabledTools changes
  );

  // Get enabled system tools
  const getEnabledSystemTools = useCallback((): Tool[] => {
    return systemTools.filter(tool => !disabledSystemTools.has(tool.id));
  }, [systemTools, disabledSystemTools]);

  // Get all enabled tools (MCP + System)
  const getAllEnabledTools = useCallback(
    (connectionId?: string): Tool[] => {
      const mcpTools = connectionId ? getEnabledTools(connectionId) : [];
      const enabledSystemTools = getEnabledSystemTools();

      return [...mcpTools, ...enabledSystemTools];
    },
    [getEnabledTools, getEnabledSystemTools]
  );

  const isToolEnabled = useCallback(
    (connectionId: string, toolId: string): boolean => {
      const disabled = disabledTools[connectionId] || new Set();
      return !disabled.has(toolId);
    },
    [disabledTools]
  );

  const isSystemToolEnabled = useCallback(
    (toolId: string): boolean => {
      return !disabledSystemTools.has(toolId);
    },
    [disabledSystemTools]
  );

  useEffect(() => {
    let mounted = true;

    async function initializeStorage() {
      try {
        await adapter.initialize();

        if (!mounted) return;

        // Set the adapter for services that need it
        ModelService.setAdapter(adapter);
        ChatService.setStorageAdapter(adapter);

        // Load existing data
        await loadExistingData();
        setIsLoading(false);
      } catch (err) {
        if (mounted) {
          console.error("Storage initialization failed:", err);
          setError(err instanceof Error ? err.message : String(err));
          setIsLoading(false);
        }
      }
    }

    async function loadExistingData() {
      try {
        const [
          storedConnections,
          storedTools,
          storedResources,
          storedConversations,
          storedExecutions,
        ] = await Promise.all([
          adapter.getConnections(), // Enhanced method
          adapter.get("tools"),
          adapter.get("resources"),
          adapter.get("conversations"),
          adapter.get("toolExecutions"),
        ]);

        setConnections(storedConnections);

        if (storedTools?.value) {
          const toolsData = storedTools.value as Record<string, Tool[]>;
          setTools(toolsData);
        } else {
          setTools({});
        }

        if (storedResources?.value) {
          const resourcesData = storedResources.value as Record<
            string,
            Resource[]
          >;
          setResources(resourcesData);
        } else {
          setResources({});
        }

        if (storedConversations?.value) {
          const conversationsData = storedConversations.value as Record<
            string,
            ChatConversation[]
          >;
          setConversations(conversationsData);
        }

        if (storedExecutions?.value) {
          const executionsData = storedExecutions.value as Record<
            string,
            ToolExecution[]
          >;
          setToolExecutions(executionsData);
        }

        // Load system tools
        setSystemTools(SystemToolsService.getSystemTools());

        // Load disabled tools for all connections
        const newDisabledTools: Record<string, Set<string>> = {};
        for (const connection of storedConnections) {
          newDisabledTools[connection.id] = await loadDisabledTools(
            connection.id
          );
        }
        setDisabledTools(newDisabledTools);

        // Load disabled system tools
        const newDisabledSystemTools = await loadDisabledSystemTools();
        setDisabledSystemTools(newDisabledSystemTools);
      } catch (err) {
        console.error("Failed to load existing data:", err);
        setError(err instanceof Error ? err.message : String(err));
      }
    }

    initializeStorage();

    return () => {
      mounted = false;
    };
  }, [adapter, loadDisabledTools, loadDisabledSystemTools]);

  const contextValue: StorageContextType = {
    adapter,
    connections,
    tools,
    systemTools,
    resources,
    conversations,
    toolExecutions,
    disabledTools,
    disabledSystemTools,
    isLoading,
    error,
    updateConnections,
    updateConversations,
    refreshConversations,
    refreshAll,
    forceRefresh,
    addConnection,
    updateConnection,
    deleteConnection,
    getEnabledTools,
    getEnabledSystemTools,
    getAllEnabledTools,
    updateDisabledTools,
    updateDisabledSystemTools,
    isToolEnabled,
    isSystemToolEnabled,
    onToolStateChange,
    onSystemToolStateChange,
    refreshToolState,
    refreshSystemToolState,
    deleteChatWithCleanup,
    clearAllChatsWithCleanup,
  };

  return (
    <StorageContext.Provider value={contextValue}>
      {children}
    </StorageContext.Provider>
  );
}

export function useStorage() {
  const context = useContext(StorageContext);
  if (context === undefined) {
    throw new Error("useStorage must be used within a StorageProvider");
  }
  return context;
}
