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
  tools: Record<string, Tool[]>;
  systemTools: Tool[];
  resources: Record<string, Resource[]>;
  conversations: Record<string, ChatConversation[]>;
  toolExecutions: Record<string, ToolExecution[]>;
  disabledTools: Record<string, Set<string>>;
  disabledSystemTools: Set<string>;
  hiddenExecutions: Record<string, Set<string>>; // NEW: connectionId -> Set of hidden execution IDs
  isLoading: boolean;
  error: string | null;
  updateConnections: (connections: Connection[]) => Promise<void>;
  updateConversations: (
    conversations: Record<string, ChatConversation[]>
  ) => Promise<void>;
  refreshConversations: () => Promise<void>;
  refreshAll: () => Promise<void>;
  addConnection: (connection: Connection) => Promise<void>;
  updateConnection: (connection: Connection) => Promise<void>;
  deleteConnection: (connectionId: string) => Promise<void>;
  getEnabledTools: (connectionId: string) => Tool[];
  getEnabledSystemTools: () => Tool[];
  getAllEnabledTools: (connectionId?: string) => Tool[];
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
  hideExecution: (connectionId: string, executionId: string) => Promise<void>; // NEW
  hideAllExecutions: (connectionId: string) => Promise<void>; // NEW
  isExecutionHidden: (connectionId: string, executionId: string) => boolean; // NEW
  getVisibleExecutions: (connectionId: string) => ToolExecution[]; // NEW
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
  const [hiddenExecutions, setHiddenExecutions] = useState<
    Record<string, Set<string>>
  >({}); // NEW
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [toolStateListeners, setToolStateListeners] = useState<
    Set<(connectionId: string) => void>
  >(new Set());

  const [systemToolStateListeners, setSystemToolStateListeners] = useState<
    Set<() => void>
  >(new Set());

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

  const onToolStateChange = useCallback(
    (callback: (connectionId: string) => void) => {
      setToolStateListeners(prev => new Set(prev).add(callback));
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

  const onSystemToolStateChange = useCallback((callback: () => void) => {
    setSystemToolStateListeners(prev => new Set(prev).add(callback));
    return () => {
      setSystemToolStateListeners(prev => {
        const newSet = new Set(prev);
        newSet.delete(callback);
        return newSet;
      });
    };
  }, []);

  // NEW: Load hidden executions for a connection
  const loadHiddenExecutions = useCallback(
    async (connectionId: string): Promise<Set<string>> => {
      try {
        const stored = await adapter.get(`hidden-executions-${connectionId}`);
        if (stored?.value && Array.isArray(stored.value)) {
          return new Set(stored.value);
        }
      } catch (error) {
        console.error(
          `Failed to load hidden executions for ${connectionId}:`,
          error
        );
      }
      return new Set();
    },
    [adapter]
  );

  // NEW: Hide a single execution
  const hideExecution = useCallback(
    async (connectionId: string, executionId: string) => {
      try {
        const currentHidden = hiddenExecutions[connectionId] || new Set();
        const newHidden = new Set(currentHidden);
        newHidden.add(executionId);

        await adapter.set(
          `hidden-executions-${connectionId}`,
          Array.from(newHidden),
          {
            type: "array",
            tags: ["mcp", "hidden-executions", connectionId],
            compress: false,
            encrypt: false,
          }
        );

        setHiddenExecutions(prev => ({
          ...prev,
          [connectionId]: newHidden,
        }));
      } catch (error) {
        console.error("Failed to hide execution:", error);
        throw error;
      }
    },
    [adapter, hiddenExecutions]
  );

  // NEW: Get visible (not hidden) executions
  const getVisibleExecutions = useCallback(
    (connectionId: string): ToolExecution[] => {
      const allExecutions = toolExecutions[connectionId] || [];
      const hidden = hiddenExecutions[connectionId] || new Set();
      return allExecutions.filter(exec => !hidden.has(exec.id));
    },
    [toolExecutions, hiddenExecutions]
  );

  // NEW: Hide all visible executions for a connection
  const hideAllExecutions = useCallback(
    async (connectionId: string) => {
      try {
        // Get ALL executions (not filtered by hidden state)
        const allExecutions = toolExecutions[connectionId] || [];

        if (allExecutions.length === 0) {
          return;
        }

        // Create new set with ALL execution IDs
        const allExecutionIds = allExecutions.map(exec => exec.id);
        const newHiddenSet = new Set(allExecutionIds);

        // Save to storage
        await adapter.set(
          `hidden-executions-${connectionId}`,
          Array.from(newHiddenSet),
          {
            type: "array",
            tags: ["mcp", "hidden-executions", connectionId],
            compress: false,
            encrypt: false,
          }
        );

        // Update local state
        setHiddenExecutions(prev => ({
          ...prev,
          [connectionId]: newHiddenSet,
        }));
      } catch (error) {
        console.error("Failed to hide all executions:", error);
        throw error;
      }
    },
    [adapter, toolExecutions]
  );

  // NEW: Check if an execution is hidden
  const isExecutionHidden = useCallback(
    (connectionId: string, executionId: string): boolean => {
      const hidden = hiddenExecutions[connectionId] || new Set();
      return hidden.has(executionId);
    },
    [hiddenExecutions]
  );

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

  const refreshToolState = useCallback(
    async (connectionId: string) => {
      try {
        const newDisabledTools = await loadDisabledTools(connectionId);
        setDisabledTools(prev => ({
          ...prev,
          [connectionId]: newDisabledTools,
        }));
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

  const refreshSystemToolState = useCallback(async () => {
    try {
      const newDisabledSystemTools = await loadDisabledSystemTools();
      setDisabledSystemTools(newDisabledSystemTools);
      notifySystemToolStateChange();
    } catch (error) {
      console.error("Failed to refresh system tool state:", error);
    }
  }, [loadDisabledSystemTools, notifySystemToolStateChange]);

  const loadAllDisabledTools = useCallback(async () => {
    const newDisabledTools: Record<string, Set<string>> = {};
    const newHiddenExecutions: Record<string, Set<string>> = {}; // NEW

    for (const connection of connections) {
      newDisabledTools[connection.id] = await loadDisabledTools(connection.id);
      newHiddenExecutions[connection.id] = await loadHiddenExecutions(
        connection.id
      ); // NEW
    }

    setDisabledTools(newDisabledTools);
    setHiddenExecutions(newHiddenExecutions); // NEW

    const newDisabledSystemTools = await loadDisabledSystemTools();
    setDisabledSystemTools(newDisabledSystemTools);
  }, [
    connections,
    loadDisabledTools,
    loadDisabledSystemTools,
    loadHiddenExecutions,
  ]);

  // ... rest of the existing implementation (getToolExecutionIdsFromChat, etc.)
  // Keep all existing methods unchanged

  const getToolExecutionIdsFromChat = useCallback(
    (chat: ChatConversation): string[] => {
      const toolExecutionIds: string[] = [];
      chat.messages.forEach(msg => {
        if (msg.executingTool || msg.toolExecution || msg.isExecuting) {
          if (msg.id) {
            toolExecutionIds.push(msg.id);
          }
        }
        if (msg.toolExecution?.toolName && msg.id) {
          toolExecutionIds.push(msg.id);
        }
      });
      return [...new Set(toolExecutionIds)];
    },
    []
  );

  const removeToolExecutionsByIds = useCallback(
    async (connectionId: string, executionIds: string[]): Promise<void> => {
      if (executionIds.length === 0) return;
      try {
        const currentExecutions = toolExecutions[connectionId] || [];
        const filteredExecutions = currentExecutions.filter(
          execution => !executionIds.includes(execution.id)
        );
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
        adapter.getConnections(),
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
      setSystemTools(SystemToolsService.getSystemTools());
      await loadAllDisabledTools();
    } catch (err) {
      console.error("Failed to refresh data:", err);
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [adapter, loadAllDisabledTools]);

  const updateConnections = useCallback(
    async (newConnections: Connection[]) => {
      try {
        await adapter.setConnections(newConnections);
        setConnections(newConnections);
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
        const newConnections = connections.filter(
          conn => conn.id !== connectionId
        );
        await updateConnections(newConnections);
        await adapter.removeConnectionData(connectionId);
        await adapter.delete(`disabled-tools-${connectionId}`);
        await adapter.delete(`hidden-executions-${connectionId}`); // NEW: Clean up hidden executions

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

        const newHiddenExecutions = { ...hiddenExecutions }; // NEW
        delete newHiddenExecutions[connectionId]; // NEW
        setHiddenExecutions(newHiddenExecutions); // NEW
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
      hiddenExecutions, // NEW
      adapter,
      updateConnections,
    ]
  );

  const updateDisabledTools = useCallback(
    async (connectionId: string, disabledToolIds: Set<string>) => {
      try {
        await adapter.set(
          `disabled-tools-${connectionId}`,
          Array.from(disabledToolIds)
        );
        setDisabledTools(prev => ({
          ...prev,
          [connectionId]: disabledToolIds,
        }));
        notifyToolStateChange(connectionId);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [adapter, notifyToolStateChange]
  );

  const updateDisabledSystemTools = useCallback(
    async (disabledToolIds: Set<string>) => {
      try {
        await adapter.set("disabled-system-tools", Array.from(disabledToolIds));
        setDisabledSystemTools(disabledToolIds);
        notifySystemToolStateChange();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [adapter, notifySystemToolStateChange]
  );

  const getEnabledTools = useCallback(
    (connectionId: string): Tool[] => {
      const allTools = tools[connectionId] || [];
      const disabled = disabledTools[connectionId] || new Set();
      return allTools.filter(tool => !disabled.has(tool.id));
    },
    [tools, disabledTools]
  );

  const getEnabledSystemTools = useCallback((): Tool[] => {
    return systemTools.filter(tool => !disabledSystemTools.has(tool.id));
  }, [systemTools, disabledSystemTools]);

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

  // Initialization effect
  useEffect(() => {
    let mounted = true;

    async function initializeStorage() {
      try {
        await adapter.initialize();
        if (!mounted) return;

        ModelService.setAdapter(adapter);
        ChatService.setStorageAdapter(adapter);

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
          adapter.getConnections(),
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

        setSystemTools(SystemToolsService.getSystemTools());

        const newDisabledTools: Record<string, Set<string>> = {};
        const newHiddenExecutions: Record<string, Set<string>> = {}; // NEW

        for (const connection of storedConnections) {
          newDisabledTools[connection.id] = await loadDisabledTools(
            connection.id
          );
          newHiddenExecutions[connection.id] = await loadHiddenExecutions(
            connection.id
          ); // NEW
        }

        setDisabledTools(newDisabledTools);
        setHiddenExecutions(newHiddenExecutions); // NEW

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
  }, [
    adapter,
    loadDisabledTools,
    loadDisabledSystemTools,
    loadHiddenExecutions,
  ]);

  // Add this useEffect to ensure data loads immediately on mount
  useEffect(() => {
    const initializeStorage = async () => {
      try {
        // Force a refresh of all data when the app mounts
        await refreshAll();
      } catch (error) {
        console.error("[StorageContext] Failed to initialize storage:", error);
      }
    };

    initializeStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run once on mount

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
    hiddenExecutions, // NEW
    isLoading,
    error,
    updateConnections,
    updateConversations,
    refreshConversations,
    refreshAll,
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
    hideExecution, // NEW
    hideAllExecutions, // NEW
    isExecutionHidden, // NEW
    getVisibleExecutions, // NEW
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
