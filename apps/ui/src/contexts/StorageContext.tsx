// apps/ui/src/contexts/StorageContext.tsx - Fixed state management and refresh
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
  forceRefresh: () => Promise<void>; // NEW: Force complete refresh
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

  // FIXED: Enhanced refresh function that properly syncs all state
  const refreshAll = useCallback(async () => {
    try {
      console.log("🔄 Refreshing all data from storage...");

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

      // Update all state atomically
      if (storedConnections?.value) {
        const connectionsArray = storedConnections.value as Connection[];
        const connectionsWithIds = connectionsArray.map(conn => ({
          ...conn,
          id: conn.id || ConnectionService.createConnection(conn).id,
        }));
        setConnections(connectionsWithIds);
        console.log("✅ Updated connections:", connectionsWithIds.length);
      }

      if (storedTools?.value) {
        setTools(storedTools.value as Record<string, Tool[]>);
        console.log("✅ Updated tools:", Object.keys(storedTools.value).length);
      }

      if (storedResources?.value) {
        setResources(storedResources.value as Record<string, Resource[]>);
        console.log(
          "✅ Updated resources:",
          Object.keys(storedResources.value).length
        );
      }

      if (storedConversations?.value) {
        const conversationsData = storedConversations.value as Record<
          string,
          ChatConversation[]
        >;
        setConversations(conversationsData);
        console.log(
          "✅ Updated conversations:",
          Object.keys(conversationsData).length
        );
      }

      if (storedExecutions?.value) {
        const executionsData = storedExecutions.value as Record<
          string,
          ToolExecution[]
        >;
        setToolExecutions(executionsData);
        console.log(
          "✅ Updated tool executions:",
          Object.keys(executionsData).length
        );

        // Log execution details for debugging
        Object.entries(executionsData).forEach(([connectionId, executions]) => {
          console.log(
            `📊 Connection ${connectionId}: ${executions.length} executions`
          );
        });
      }

      console.log("✅ All data refreshed successfully");
    } catch (err) {
      console.error("❌ Failed to refresh data:", err);
    }
  }, [adapter]);

  // NEW: Force refresh that clears state first
  const forceRefresh = useCallback(async () => {
    console.log("🔄 Force refreshing all data...");

    // Clear all state first
    setConnections([]);
    setTools({});
    setResources({});
    setConversations({});
    setToolExecutions({});

    // Then refresh
    await refreshAll();
  }, [refreshAll]);

  // Method to update connections both in storage and state
  const updateConnections = useCallback(
    async (newConnections: Connection[]) => {
      try {
        await adapter.set("connections", newConnections);
        setConnections(newConnections);
        console.log("✅ Updated connections in storage and state");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [adapter]
  );

  // FIXED: Enhanced conversation update with immediate state sync
  const updateConversations = useCallback(
    async (newConversations: Record<string, ChatConversation[]>) => {
      try {
        await adapter.set("conversations", newConversations);
        setConversations(newConversations);
        console.log("✅ Updated conversations in storage and state");
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
        console.log("✅ Refreshed conversations from storage");
      }
    } catch (err) {
      console.error("Failed to refresh conversations:", err);
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
        console.log("🚀 Initializing storage...");
        await adapter.initialize();

        if (!mounted) return;

        // Try to load existing data first
        const hasExistingData = await loadExistingData();

        // Only load mock data if no existing data found
        if (!hasExistingData) {
          console.log("📦 No existing data found, loading mock data...");
          await loadMockData();
        }

        setIsLoading(false);
        console.log("✅ Storage initialization complete");
      } catch (err) {
        if (mounted) {
          console.error("❌ Storage initialization failed:", err);
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
          console.log("📭 No existing data found");
          return false;
        }

        console.log("📦 Loading existing data...");

        // Load existing data into state
        if (storedConnections?.value) {
          const connectionsArray = storedConnections.value as Connection[];
          // Ensure all connections have IDs
          const connectionsWithIds = connectionsArray.map(conn => ({
            ...conn,
            id: conn.id || ConnectionService.createConnection(conn).id,
          }));
          setConnections(connectionsWithIds);
          console.log("✅ Loaded connections:", connectionsWithIds.length);
        }

        if (storedTools?.value) {
          setTools(storedTools.value as Record<string, Tool[]>);
          console.log("✅ Loaded tools");
        }

        if (storedResources?.value) {
          setResources(storedResources.value as Record<string, Resource[]>);
          console.log("✅ Loaded resources");
        }

        if (storedConversations?.value) {
          const conversationsData = storedConversations.value as Record<
            string,
            ChatConversation[]
          >;
          setConversations(conversationsData);
          console.log("✅ Loaded conversations");
        }

        if (storedExecutions?.value) {
          const executionsData = storedExecutions.value as Record<
            string,
            ToolExecution[]
          >;
          setToolExecutions(executionsData);
          console.log("✅ Loaded tool executions");

          // Debug log executions
          Object.entries(executionsData).forEach(
            ([connectionId, executions]) => {
              console.log(
                `📊 Connection ${connectionId}: ${executions.length} executions`
              );
            }
          );
        }

        return true;
      } catch (err) {
        console.error("❌ Failed to load existing data:", err);
        return false;
      }
    }

    async function loadMockData() {
      try {
        // Validate mock data before loading
        if (!mockData.validateMockData()) {
          throw new Error("Mock data validation failed");
        }

        console.log("📦 Loading mock data...");

        // Load connections with proper IDs
        await adapter.set("connections", mockData.connections);
        setConnections(mockData.connections);
        console.log("✅ Loaded mock connections:", mockData.connections.length);

        // Load tools (keyed by connection ID, not index)
        await adapter.set("tools", mockData.tools);
        setTools(mockData.tools);
        console.log("✅ Loaded mock tools");

        // Load resources (keyed by connection ID, not index)
        await adapter.set("resources", mockData.resources);
        setResources(mockData.resources);
        console.log("✅ Loaded mock resources");

        // Load conversations (keyed by connection ID, not index)
        await adapter.set("conversations", mockData.conversations);
        setConversations(mockData.conversations);
        console.log("✅ Loaded mock conversations");

        // Load tool executions (keyed by connection ID, not index)
        await adapter.set("toolExecutions", mockData.toolExecutions);
        setToolExecutions(mockData.toolExecutions);
        console.log("✅ Loaded mock tool executions");

        // Debug log executions
        Object.entries(mockData.toolExecutions).forEach(
          ([connectionId, executions]) => {
            console.log(
              `📊 Mock connection ${connectionId}: ${executions.length} executions`
            );
          }
        );
      } catch (err) {
        console.error("❌ Failed to load mock data:", err);
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
    forceRefresh,
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
