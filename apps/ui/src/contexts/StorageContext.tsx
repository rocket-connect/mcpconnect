import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { LocalStorageAdapter } from "@mcpconnect/adapter-localstorage";
import { StorageAdapter } from "@mcpconnect/base-adapters";
import {
  Connection,
  Tool,
  Resource,
  ToolExecution,
  ChatConversation,
} from "@mcpconnect/schemas";
import mockData from "../data/mockData";
import { ConnectionService } from "../services/connectionService";

interface StorageContextType {
  adapter: StorageAdapter;
  connections: Connection[];
  tools: Record<string, Tool[]>; // Keyed by connection ID
  resources: Record<string, Resource[]>; // Keyed by connection ID
  conversations: Record<string, ChatConversation[]>; // Keyed by connection ID
  toolExecutions: Record<string, ToolExecution[]>; // Keyed by connection ID
  isLoading: boolean;
  error: string | null;
  // Methods to update data and trigger reactive updates
  updateConnections: (connections: Connection[]) => Promise<void>;
  updateConversations: (
    conversations: Record<string, ChatConversation[]>
  ) => Promise<void>;
  refreshConversations: () => Promise<void>;
  refreshAll: () => Promise<void>;
  // Connection management methods
  addConnection: (connection: Connection) => Promise<void>;
  updateConnection: (connection: Connection) => Promise<void>;
  deleteConnection: (connectionId: string) => Promise<void>;
}

const StorageContext = createContext<StorageContextType | undefined>(undefined);

export function StorageProvider({ children }: { children: React.ReactNode }) {
  const [adapter] = useState(
    () =>
      new LocalStorageAdapter({
        name: "mcpconnect-storage",
        provider: "localstorage",
        prefix: "mcpconnect:",
        debug: true,
        timeout: 30000,
        retries: 3,
        compression: false,
        encryption: false,
        autoCleanup: true,
        cleanupInterval: 3600000, // 1 hour
        maxSize: 10 * 1024 * 1024, // 10MB
        maxItemSize: 5 * 1024 * 1024, // 5MB per item
        simulateAsync: false,
      })
  );

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

  // Method to update connections both in storage and state
  const updateConnections = useCallback(
    async (newConnections: Connection[]) => {
      try {
        await adapter.set("connections", newConnections);
        setConnections(newConnections);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [adapter]
  );

  // Method to update conversations both in storage and state
  const updateConversations = useCallback(
    async (newConversations: Record<string, ChatConversation[]>) => {
      try {
        await adapter.set("conversations", newConversations);
        setConversations(newConversations);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [adapter]
  );

  // Method to refresh conversations from storage
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

  // Method to refresh all data from storage
  const refreshAll = useCallback(async () => {
    try {
      const [
        storedConnections,
        storedTools,
        storedResources,
        storedConversations,
        storedExecutions,
      ] = await Promise.all([
        adapter.get("connections"),
        adapter.get("tools"),
        adapter.get("resources"),
        adapter.get("conversations"),
        adapter.get("toolExecutions"),
      ]);

      if (storedConnections?.value) {
        setConnections(storedConnections.value as Connection[]);
      }
      if (storedTools?.value) {
        setTools(storedTools.value as Record<string, Tool[]>);
      }
      if (storedResources?.value) {
        setResources(storedResources.value as Record<string, Resource[]>);
      }
      if (storedConversations?.value) {
        setConversations(
          storedConversations.value as Record<string, ChatConversation[]>
        );
      }
      if (storedExecutions?.value) {
        setToolExecutions(
          storedExecutions.value as Record<string, ToolExecution[]>
        );
      }
    } catch (err) {
      console.error("Failed to refresh data:", err);
    }
  }, [adapter]);

  // Connection management methods
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
      // Remove connection
      const newConnections = connections.filter(
        conn => conn.id !== connectionId
      );
      await updateConnections(newConnections);

      // Remove associated data
      const newConversations = { ...conversations };
      delete newConversations[connectionId];
      await updateConversations(newConversations);

      const newTools = { ...tools };
      delete newTools[connectionId];
      await adapter.set("tools", newTools);
      setTools(newTools);

      const newResources = { ...resources };
      delete newResources[connectionId];
      await adapter.set("resources", newResources);
      setResources(newResources);

      const newToolExecutions = { ...toolExecutions };
      delete newToolExecutions[connectionId];
      await adapter.set("toolExecutions", newToolExecutions);
      setToolExecutions(newToolExecutions);
    },
    [
      connections,
      conversations,
      tools,
      resources,
      toolExecutions,
      adapter,
      updateConnections,
      updateConversations,
    ]
  );

  useEffect(() => {
    let mounted = true;

    async function initializeStorage() {
      try {
        await adapter.initialize();

        if (!mounted) return;

        // Try to load existing data first
        const hasExistingData = await loadExistingData();

        // Only load mock data if no existing data found
        if (!hasExistingData) {
          await loadMockData();
        }

        setIsLoading(false);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : String(err));
          setIsLoading(false);
        }
      }
    }

    async function loadExistingData(): Promise<boolean> {
      try {
        const [
          storedConnections,
          storedTools,
          storedResources,
          storedConversations,
          storedExecutions,
        ] = await Promise.all([
          adapter.get("connections"),
          adapter.get("tools"),
          adapter.get("resources"),
          adapter.get("conversations"),
          adapter.get("toolExecutions"),
        ]);

        // Check if we have any existing data
        const hasData =
          storedConnections?.value ||
          storedTools?.value ||
          storedResources?.value ||
          storedConversations?.value ||
          storedExecutions?.value;

        if (!hasData) {
          console.log("No existing data found, will load mock data");
          return false;
        }

        // Load existing data into state
        if (storedConnections?.value) {
          const connectionsArray = storedConnections.value as Connection[];
          // Ensure all connections have IDs
          const connectionsWithIds = connectionsArray.map(conn => ({
            ...conn,
            id: conn.id || ConnectionService.createConnection(conn).id,
          }));
          setConnections(connectionsWithIds);
        }

        if (storedTools?.value) {
          setTools(storedTools.value as Record<string, Tool[]>);
        }

        if (storedResources?.value) {
          setResources(storedResources.value as Record<string, Resource[]>);
        }

        if (storedConversations?.value) {
          const conversationsData = storedConversations.value as Record<
            string,
            ChatConversation[]
          >;
          setConversations(conversationsData);
        }

        if (storedExecutions?.value) {
          setToolExecutions(
            storedExecutions.value as Record<string, ToolExecution[]>
          );
        }

        return true;
      } catch (err) {
        console.error("Failed to load existing data:", err);
        return false;
      }
    }

    async function loadMockData() {
      try {
        // Validate mock data before loading
        if (!mockData.validateMockData()) {
          throw new Error("Mock data validation failed");
        }

        // Load connections with proper IDs
        await adapter.set("connections", mockData.connections);
        setConnections(mockData.connections);

        // Load tools (keyed by connection ID, not index)
        await adapter.set("tools", mockData.tools);
        setTools(mockData.tools);

        // Load resources (keyed by connection ID, not index)
        await adapter.set("resources", mockData.resources);
        setResources(mockData.resources);

        // Load conversations (keyed by connection ID, not index)
        await adapter.set("conversations", mockData.conversations);
        setConversations(mockData.conversations);

        // Load tool executions (keyed by connection ID, not index)
        await adapter.set("toolExecutions", mockData.toolExecutions);
        setToolExecutions(mockData.toolExecutions);
      } catch (err) {
        console.error("Failed to load mock data:", err);
        setError(err instanceof Error ? err.message : String(err));
      }
    }

    initializeStorage();

    return () => {
      mounted = false;
    };
  }, [adapter]);

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
    addConnection,
    updateConnection,
    deleteConnection,
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
