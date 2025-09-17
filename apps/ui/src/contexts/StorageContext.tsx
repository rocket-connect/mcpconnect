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

interface StorageContextType {
  adapter: LocalStorageAdapter;
  connections: Connection[];
  tools: Record<string, Tool[]>;
  resources: Record<string, Resource[]>;
  conversations: Record<string, ChatConversation[]>;
  toolExecutions: Record<string, ToolExecution[]>;
  disabledTools: Record<string, Set<string>>; // connectionId -> Set of disabled tool IDs
  isLoading: boolean;
  error: string | null;
  // Optimized update methods using adapter
  updateConnections: (connections: Connection[]) => Promise<void>;
  updateConversations: (
    conversations: Record<string, ChatConversation[]>
  ) => Promise<void>;
  refreshConversations: () => Promise<void>;
  refreshAll: () => Promise<void>;
  forceRefresh: () => Promise<void>;
  // Connection management methods
  addConnection: (connection: Connection) => Promise<void>;
  updateConnection: (connection: Connection) => Promise<void>;
  deleteConnection: (connectionId: string) => Promise<void>;
  // Tool management methods - WITH REACTIVITY
  getEnabledTools: (connectionId: string) => Tool[];
  updateDisabledTools: (
    connectionId: string,
    disabledToolIds: Set<string>
  ) => Promise<void>;
  isToolEnabled: (connectionId: string, toolId: string) => boolean;
  // NEW: Tool state change listener
  onToolStateChange: (callback: (connectionId: string) => void) => () => void;
  // NEW: Force tool state refresh for specific connection
  refreshToolState: (connectionId: string) => Promise<void>;
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // NEW: Tool state change listeners
  const [toolStateListeners, setToolStateListeners] = useState<
    Set<(connectionId: string) => void>
  >(new Set());

  // NEW: Notify listeners when tool state changes
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

  // NEW: Add tool state change listener
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

  // NEW: Refresh tool state for specific connection
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

  // Load disabled tools for all connections
  const loadAllDisabledTools = useCallback(async () => {
    const newDisabledTools: Record<string, Set<string>> = {};

    for (const connection of connections) {
      newDisabledTools[connection.id] = await loadDisabledTools(connection.id);
    }

    setDisabledTools(newDisabledTools);
  }, [connections, loadDisabledTools]);

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
    setResources({});
    setConversations({});
    setToolExecutions({});
    setDisabledTools({});

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

  // UPDATED: Tool management methods with reactivity
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

  // UPDATED: Always get fresh tool state
  const getEnabledTools = useCallback(
    (connectionId: string): Tool[] => {
      const allTools = tools[connectionId] || [];
      const disabled = disabledTools[connectionId] || new Set();

      return allTools.filter(tool => !disabled.has(tool.id));
    },
    [tools, disabledTools] // This will cause re-computation when disabledTools changes
  );

  const isToolEnabled = useCallback(
    (connectionId: string, toolId: string): boolean => {
      const disabled = disabledTools[connectionId] || new Set();
      return !disabled.has(toolId);
    },
    [disabledTools]
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

        // Load disabled tools for all connections
        const newDisabledTools: Record<string, Set<string>> = {};
        for (const connection of storedConnections) {
          newDisabledTools[connection.id] = await loadDisabledTools(
            connection.id
          );
        }
        setDisabledTools(newDisabledTools);
      } catch (err) {
        console.error("Failed to load existing data:", err);
        setError(err instanceof Error ? err.message : String(err));
      }
    }

    initializeStorage();

    return () => {
      mounted = false;
    };
  }, [adapter, loadDisabledTools]);

  const contextValue: StorageContextType = {
    adapter,
    connections,
    tools,
    resources,
    conversations,
    toolExecutions,
    disabledTools,
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
    updateDisabledTools,
    isToolEnabled,
    // NEW exports
    onToolStateChange,
    refreshToolState,
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
