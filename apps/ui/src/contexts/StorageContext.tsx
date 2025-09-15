// apps/ui/src/contexts/StorageContext.tsx - Fixed to properly load discovered tools
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
  // Tool and resource refresh methods
  refreshTools: () => Promise<void>;
  refreshResources: () => Promise<void>;
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshTools = useCallback(async () => {
    try {
      console.log("[StorageContext] Refreshing tools from storage...");
      const storedTools = await adapter.get("tools");
      if (storedTools?.value) {
        const toolsData = storedTools.value as Record<string, Tool[]>;
        console.log("[StorageContext] Loaded tools:", toolsData);
        setTools(toolsData);
      } else {
        console.log("[StorageContext] No tools found in storage");
        setTools({});
      }
    } catch (err) {
      console.error("Failed to refresh tools:", err);
    }
  }, [adapter]);

  const refreshResources = useCallback(async () => {
    try {
      console.log("[StorageContext] Refreshing resources from storage...");
      const storedResources = await adapter.get("resources");
      if (storedResources?.value) {
        const resourcesData = storedResources.value as Record<
          string,
          Resource[]
        >;
        console.log("[StorageContext] Loaded resources:", resourcesData);
        setResources(resourcesData);
      } else {
        console.log("[StorageContext] No resources found in storage");
        setResources({});
      }
    } catch (err) {
      console.error("Failed to refresh resources:", err);
    }
  }, [adapter]);

  const refreshAll = useCallback(async () => {
    try {
      console.log("Refreshing all data from storage...");

      // Use enhanced adapter methods for better performance
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

      // Update all state atomically
      console.log("[StorageContext] Setting connections:", storedConnections);
      setConnections(storedConnections);

      if (storedTools?.value) {
        const toolsData = storedTools.value as Record<string, Tool[]>;
        console.log("[StorageContext] Setting tools:", toolsData);
        setTools(toolsData);
      } else {
        console.log("[StorageContext] No tools in storage, setting empty");
        setTools({});
      }

      if (storedResources?.value) {
        const resourcesData = storedResources.value as Record<
          string,
          Resource[]
        >;
        console.log("[StorageContext] Setting resources:", resourcesData);
        setResources(resourcesData);
      } else {
        console.log("[StorageContext] No resources in storage, setting empty");
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

      // Log final state for debugging
      console.log("[StorageContext] Final state summary:");
      console.log(`  - Connections: ${storedConnections.length}`);
      console.log(
        `  - Tools by connection:`,
        Object.keys(storedTools?.value || {}).length
      );
      console.log(
        `  - Resources by connection:`,
        Object.keys(storedResources?.value || {}).length
      );
    } catch (err) {
      console.error("Failed to refresh data:", err);
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [adapter]);

  const forceRefresh = useCallback(async () => {
    console.log("Force refreshing all data...");

    // Clear all state first
    setConnections([]);
    setTools({});
    setResources({});
    setConversations({});
    setToolExecutions({});

    // Then refresh
    await refreshAll();
  }, [refreshAll]);

  const updateConnections = useCallback(
    async (newConnections: Connection[]) => {
      try {
        console.log("[StorageContext] Updating connections:", newConnections);
        await adapter.setConnections(newConnections); // Use enhanced method
        setConnections(newConnections);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [adapter]
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
      adapter,
      updateConnections,
    ]
  );

  useEffect(() => {
    let mounted = true;

    async function initializeStorage() {
      try {
        console.log("Initializing storage...");
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
        console.log("[StorageContext] Loading existing data...");

        // Use enhanced adapter methods for better performance
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

        // Load existing data into state
        console.log("[StorageContext] Loaded connections:", storedConnections);
        setConnections(storedConnections);

        if (storedTools?.value) {
          const toolsData = storedTools.value as Record<string, Tool[]>;
          console.log("[StorageContext] Loaded tools from storage:", toolsData);
          setTools(toolsData);

          // Log each connection's tools for debugging
          Object.entries(toolsData).forEach(
            ([connectionId, connectionTools]) => {
              console.log(
                `[StorageContext] Connection ${connectionId} has ${connectionTools.length} tools:`,
                connectionTools.map(t => t.name)
              );
            }
          );
        } else {
          console.log(
            "[StorageContext] No tools found in storage during initialization"
          );
          setTools({});
        }

        if (storedResources?.value) {
          const resourcesData = storedResources.value as Record<
            string,
            Resource[]
          >;
          console.log(
            "[StorageContext] Loaded resources from storage:",
            resourcesData
          );
          setResources(resourcesData);
        } else {
          console.log("[StorageContext] No resources found in storage");
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
      } catch (err) {
        console.error("Failed to load existing data:", err);
        setError(err instanceof Error ? err.message : String(err));
      }
    }

    initializeStorage();

    return () => {
      mounted = false;
    };
  }, [adapter]);

  // Add effect to watch for tool changes and log them
  useEffect(() => {
    console.log("[StorageContext] Tools state updated:", tools);
    Object.entries(tools).forEach(([connectionId, connectionTools]) => {
      if (connectionTools.length > 0) {
        console.log(
          `[StorageContext] Connection ${connectionId} tools:`,
          connectionTools.map(t => ({
            id: t.id,
            name: t.name,
            description: t.description,
          }))
        );
      }
    });
  }, [tools]);

  const contextValue: StorageContextType = {
    adapter,
    connections,
    tools,
    resources,
    conversations,
    toolExecutions,
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
    refreshTools,
    refreshResources,
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
