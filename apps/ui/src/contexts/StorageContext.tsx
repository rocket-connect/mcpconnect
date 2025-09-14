// apps/ui/src/contexts/StorageContext.tsx - Fixed to preserve user data
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

interface StorageContextType {
  adapter: StorageAdapter;
  connections: Connection[];
  tools: Record<string, Tool[]>; // Keyed by connection index
  resources: Record<string, Resource[]>; // Keyed by connection index
  conversations: Record<string, ChatConversation[]>; // Keyed by connection index
  toolExecutions: Record<string, ToolExecution[]>; // Keyed by connection index
  isLoading: boolean;
  error: string | null;
  // Methods to update data and trigger reactive updates
  updateConversations: (
    conversations: Record<string, ChatConversation[]>
  ) => Promise<void>;
  refreshConversations: () => Promise<void>;
  refreshAll: () => Promise<void>;
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

  // Method to update conversations both in storage and state
  const updateConversations = useCallback(
    async (newConversations: Record<string, ChatConversation[]>) => {
      try {
        console.log("Updating conversations:", newConversations);
        await adapter.set("conversations", newConversations);
        setConversations(newConversations);
        console.log("Conversations updated successfully");
      } catch (err) {
        console.error("Failed to update conversations:", err);
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
        console.log(
          "Refreshed conversations from storage:",
          Object.keys(conversationsData).length,
          "connections"
        );
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

      console.log("Refreshed all data from storage");
    } catch (err) {
      console.error("Failed to refresh data:", err);
    }
  }, [adapter]);

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
        console.log("=== LOADING EXISTING DATA ===");

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

        console.log("Found existing data, loading from storage");

        // Load existing data into state
        if (storedConnections?.value) {
          setConnections(storedConnections.value as Connection[]);
          console.log(
            "Loaded existing connections:",
            (storedConnections.value as Connection[]).length
          );
        }

        if (storedTools?.value) {
          setTools(storedTools.value as Record<string, Tool[]>);
          console.log(
            "Loaded existing tools:",
            Object.keys(storedTools.value as Record<string, Tool[]>).length,
            "connection(s)"
          );
        }

        if (storedResources?.value) {
          setResources(storedResources.value as Record<string, Resource[]>);
          console.log(
            "Loaded existing resources:",
            Object.keys(storedResources.value as Record<string, Resource[]>)
              .length,
            "connection(s)"
          );
        }

        if (storedConversations?.value) {
          const conversationsData = storedConversations.value as Record<
            string,
            ChatConversation[]
          >;
          setConversations(conversationsData);
          console.log("Loaded existing conversations:");
          Object.entries(conversationsData).forEach(([connId, chats]) => {
            console.log(`  Connection ${connId}: ${chats.length} chat(s)`);
            chats.forEach((chat, idx) => {
              console.log(
                `    Chat ${idx} (${chat.title}): ${chat.messages.length} messages`
              );
            });
          });
        }

        if (storedExecutions?.value) {
          setToolExecutions(
            storedExecutions.value as Record<string, ToolExecution[]>
          );
          console.log(
            "Loaded existing tool executions:",
            Object.keys(
              storedExecutions.value as Record<string, ToolExecution[]>
            ).length,
            "connection(s)"
          );
        }

        console.log("=== EXISTING DATA LOADING COMPLETE ===");
        return true;
      } catch (err) {
        console.error("Failed to load existing data:", err);
        return false;
      }
    }

    async function loadMockData() {
      try {
        console.log("=== LOADING MOCK DATA (FIRST TIME ONLY) ===");

        // Validate mock data before loading
        if (!mockData.validateMockData()) {
          throw new Error("Mock data validation failed");
        }

        // Load connections
        await adapter.set("connections", mockData.connections);
        setConnections(mockData.connections);
        console.log("Loaded mock connections:", mockData.connections.length);

        // Load tools
        await adapter.set("tools", mockData.tools);
        setTools(mockData.tools);
        console.log(
          "Loaded mock tools:",
          Object.keys(mockData.tools).length,
          "connection(s)"
        );

        // Load resources
        await adapter.set("resources", mockData.resources);
        setResources(mockData.resources);
        console.log(
          "Loaded mock resources:",
          Object.keys(mockData.resources).length,
          "connection(s)"
        );

        // Load conversations
        await adapter.set("conversations", mockData.conversations);
        setConversations(mockData.conversations);
        console.log("Loaded mock conversations:");
        Object.entries(mockData.conversations).forEach(([connId, chats]) => {
          console.log(`  Connection ${connId}: ${chats.length} chat(s)`);
          chats.forEach((chat, idx) => {
            const toolMessages = chat.messages.filter(
              msg => Boolean(msg.executingTool) || Boolean(msg.toolExecution)
            );
            console.log(
              `    Chat ${idx} (${chat.title}): ${chat.messages.length} messages, ${toolMessages.length} tool messages`
            );
          });
        });

        // Load tool executions
        await adapter.set("toolExecutions", mockData.toolExecutions);
        setToolExecutions(mockData.toolExecutions);
        console.log("Loaded mock tool executions:");
        Object.entries(mockData.toolExecutions).forEach(([connId, execs]) => {
          console.log(`  Connection ${connId}: ${execs.length} execution(s)`);
        });

        console.log("=== MOCK DATA LOADING COMPLETE ===");
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
    updateConversations,
    refreshConversations,
    refreshAll,
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
