// apps/ui/src/contexts/StorageContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { LocalStorageAdapter } from "@mcpconnect/adapter-localstorage";
import { StorageAdapter } from "@mcpconnect/base-adapters";
import {
  Connection,
  Tool,
  Resource,
  ChatMessage,
  ToolExecution,
} from "@mcpconnect/schemas";

interface StorageContextType {
  adapter: StorageAdapter;
  connections: Connection[];
  tools: Tool[];
  resources: Resource[];
  chatMessages: ChatMessage[];
  toolExecutions: ToolExecution[];
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
        simulateAsync: false, // Don't simulate async behavior
      })
  );

  const [connections, setConnections] = useState<Connection[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function initializeStorage() {
      try {
        await adapter.initialize();

        if (!mounted) return;

        // Load or create mock data using the adapter
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
        // Load connections
        const connectionsItem = await adapter.get("connections");
        if (connectionsItem) {
          setConnections(connectionsItem.value as Connection[]);
        } else {
          // Create mock connections and store them
          const mockConnections: Connection[] = [
            {
              name: "Database Server",
              url: "ws://localhost:8080",
              isActive: true,
              isConnected: true,
              retryAttempts: 3,
              authType: "none",
            },
            {
              name: "File System",
              url: "ws://localhost:8081",
              isActive: false,
              isConnected: false,
              retryAttempts: 3,
              authType: "none",
            },
            {
              name: "Email API",
              url: "https://api.email.com",
              isActive: false,
              isConnected: false,
              retryAttempts: 3,
              authType: "bearer",
            },
          ];
          await adapter.set("connections", mockConnections);
          setConnections(mockConnections);
        }

        // Load tools
        const toolsItem = await adapter.get("tools");
        if (toolsItem) {
          setTools(toolsItem.value as Tool[]);
        } else {
          const mockTools: Tool[] = [
            {
              name: "query_database",
              description: "Execute SQL queries on database",
              deprecated: false,
              parameters: [
                {
                  name: "query",
                  type: "string",
                  description: "SQL query to execute",
                  required: true,
                },
                {
                  name: "timeout",
                  type: "number",
                  description: "Query timeout in milliseconds",
                  required: false,
                  default: 5000,
                },
              ],
              category: "database",
              tags: ["sql", "query"],
            },
            {
              name: "get_schema",
              description: "Get database schema information",
              deprecated: false,
              parameters: [
                {
                  name: "table",
                  type: "string",
                  description: "Table name to get schema for",
                  required: false,
                },
              ],
              category: "database",
              tags: ["schema", "metadata"],
            },
            {
              name: "backup_data",
              description: "Create database backup",
              deprecated: false,
              parameters: [
                {
                  name: "format",
                  type: "string",
                  description: "Backup format (sql, json)",
                  required: false,
                  default: "sql",
                },
                {
                  name: "compress",
                  type: "boolean",
                  description: "Whether to compress the backup",
                  required: false,
                  default: false,
                },
              ],
              category: "database",
              tags: ["backup", "export"],
            },
          ];
          await adapter.set("tools", mockTools);
          setTools(mockTools);
        }

        // Load resources
        const resourcesItem = await adapter.get("resources");
        if (resourcesItem) {
          setResources(resourcesItem.value as Resource[]);
        } else {
          const mockResources: Resource[] = [
            {
              name: "tables",
              description: "Available database tables",
              type: "table",
              uri: "mcp://database/tables",
              mimeType: "application/json",
              permissions: {
                read: true,
                write: false,
                delete: false,
              },
              tags: ["database", "schema"],
            },
            {
              name: "stats",
              description: "Database performance statistics",
              type: "stats",
              uri: "mcp://database/stats",
              mimeType: "application/json",
              permissions: {
                read: true,
                write: false,
                delete: false,
              },
              tags: ["performance", "monitoring"],
            },
          ];
          await adapter.set("resources", mockResources);
          setResources(mockResources);
        }

        // Load chat messages
        const messagesItem = await adapter.get("chatMessages");
        if (messagesItem) {
          setChatMessages(messagesItem.value as ChatMessage[]);
        } else {
          const mockMessages: ChatMessage[] = [
            {
              id: "1",
              message:
                "Can you query the database for all users created this month?",
              isUser: true,
              isExecuting: false,
              timestamp: new Date("2025-01-15T10:30:00Z"),
            },
            {
              id: "2",
              message:
                "I'll query the database for users created this month. Let me execute that query for you...",
              isUser: false,
              isExecuting: false,
              timestamp: new Date("2025-01-15T10:30:01Z"),
            },
            {
              id: "3",
              isUser: false,
              isExecuting: true,
              executingTool: "query_database",
              timestamp: new Date("2025-01-15T10:30:02Z"),
              toolExecution: {
                toolName: "query_database",
                status: "pending",
              },
            },
            {
              id: "4",
              message:
                "Found 47 users created this month. The query returned: SELECT COUNT(*) FROM users WHERE created_at >= ... Result: 47 users",
              isUser: false,
              isExecuting: false,
              timestamp: new Date("2025-01-15T10:30:47Z"),
              toolExecution: {
                toolName: "query_database",
                status: "success",
                result: {
                  count: 47,
                  execution_time: 142,
                },
              },
            },
          ];
          await adapter.set("chatMessages", mockMessages);
          setChatMessages(mockMessages);
        }

        // Load tool executions
        const executionsItem = await adapter.get("toolExecutions");
        if (executionsItem) {
          setToolExecutions(executionsItem.value as ToolExecution[]);
        } else {
          const mockExecutions: ToolExecution[] = [
            {
              id: "1",
              tool: "query_database",
              status: "success",
              duration: 142,
              timestamp: "10:30:47",
              request: {
                tool: "query_database",
                arguments: {
                  query:
                    "SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '1 month'",
                  timeout: 5000,
                },
                timestamp: "2025-01-15T10:30:45Z",
              },
              response: {
                success: true,
                result: {
                  count: 47,
                  execution_time: 142,
                },
                timestamp: "2025-01-15T10:30:47Z",
              },
            },
            {
              id: "2",
              tool: "get_schema",
              status: "success",
              duration: 89,
              timestamp: "10:29:15",
              request: {
                tool: "get_schema",
                arguments: { table: "users" },
                timestamp: "2025-01-15T10:29:13Z",
              },
              response: {
                success: true,
                result: {
                  columns: [
                    { name: "id", type: "INTEGER", nullable: false },
                    { name: "email", type: "VARCHAR", nullable: false },
                    { name: "created_at", type: "TIMESTAMP", nullable: false },
                  ],
                },
                timestamp: "2025-01-15T10:29:15Z",
              },
            },
            {
              id: "3",
              tool: "backup_data",
              status: "error",
              duration: 2341,
              timestamp: "10:25:32",
              request: {
                tool: "backup_data",
                arguments: { format: "sql", compress: true },
                timestamp: "2025-01-15T10:25:30Z",
              },
              error:
                "Permission denied: insufficient privileges for backup operation",
            },
            {
              id: "4",
              tool: "query_database",
              status: "pending",
              timestamp: "10:30:50",
              request: {
                tool: "query_database",
                arguments: {
                  query:
                    "SELECT * FROM orders WHERE status = 'pending' ORDER BY created_at DESC LIMIT 10",
                },
                timestamp: "2025-01-15T10:30:50Z",
              },
            },
          ];
          await adapter.set("toolExecutions", mockExecutions);
          setToolExecutions(mockExecutions);
        }
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
    chatMessages,
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
