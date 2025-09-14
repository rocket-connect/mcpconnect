// apps/ui/src/contexts/StorageContext.tsx - Updated to use separate mock data file
import React, { createContext, useContext, useEffect, useState } from "react";
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

  useEffect(() => {
    let mounted = true;

    async function initializeStorage() {
      try {
        await adapter.initialize();

        if (!mounted) return;

        await loadMockData();
        setIsLoading(false);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : String(err));
          setIsLoading(false);
        }
      }
    }

    async function loadMockData() {
      try {
        console.log("=== LOADING MOCK DATA ===");

        // Clear existing data for clean start
        await adapter.clear();

        // Validate mock data before loading
        if (!mockData.validateMockData()) {
          throw new Error("Mock data validation failed");
        }

        // Load connections
        await adapter.set("connections", mockData.connections);
        setConnections(mockData.connections);
        console.log("Loaded connections:", mockData.connections.length);

        // Load tools
        await adapter.set("tools", mockData.tools);
        setTools(mockData.tools);
        console.log(
          "Loaded tools:",
          Object.keys(mockData.tools).length,
          "connection(s)"
        );

        // Load resources
        await adapter.set("resources", mockData.resources);
        setResources(mockData.resources);
        console.log(
          "Loaded resources:",
          Object.keys(mockData.resources).length,
          "connection(s)"
        );

        // Load conversations
        await adapter.set("conversations", mockData.conversations);
        setConversations(mockData.conversations);
        console.log("Loaded conversations:");
        Object.entries(mockData.conversations).forEach(([connId, chats]) => {
          console.log(`  Connection ${connId}: ${chats.length} chat(s)`);
          chats.forEach((chat, idx) => {
            const toolMessages = chat.messages.filter(
              msg => Boolean(msg.executingTool) || Boolean(msg.toolExecution)
            );
            console.log(
              `    Chat ${idx} (${chat.title}): ${chat.messages.length} messages, ${toolMessages.length} tool messages`
            );
            toolMessages.forEach(msg => {
              console.log(
                `      Tool message ID: ${msg.id}, tool: ${msg.executingTool || msg.toolExecution?.toolName}`
              );
            });
          });
        });

        // Load tool executions
        await adapter.set("toolExecutions", mockData.toolExecutions);
        setToolExecutions(mockData.toolExecutions);
        console.log("Loaded tool executions:");
        Object.entries(mockData.toolExecutions).forEach(([connId, execs]) => {
          console.log(`  Connection ${connId}: ${execs.length} execution(s)`);
          execs.forEach(exec => {
            console.log(
              `    Execution ID: ${exec.id}, tool: ${exec.tool}, status: ${exec.status}`
            );
          });
        });

        // Cross-reference validation
        console.log("=== CROSS-REFERENCE VALIDATION ===");
        Object.entries(mockData.conversations).forEach(([connId, chats]) => {
          const connectionExecutions = mockData.toolExecutions[connId] || [];
          chats.forEach(chat => {
            const toolMessages = chat.messages.filter(
              msg => Boolean(msg.executingTool) || Boolean(msg.toolExecution)
            );

            toolMessages.forEach(msg => {
              const matchingExecution = connectionExecutions.find(
                exec => exec.id === msg.id
              );
              if (matchingExecution) {
                console.log(`✓ Message ${msg.id} has matching execution`);
              } else {
                console.warn(`✗ Message ${msg.id} has no matching execution`);
              }
            });
          });
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
